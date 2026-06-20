"""
Order management endpoints.

Core business rules enforced here:
- An order cannot be created if any line item exceeds available stock.
- Creating an order atomically reduces stock for every product involved.
- total_amount is always computed server-side from current product prices;
  the client never sends a price or total.
- The whole "validate -> deduct stock -> create order" sequence happens in
  a single DB transaction, so a failure partway through leaves no partial
  stock deduction or orphaned order behind.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")

    # Merge duplicate product_id entries in the request so quantities don't
    # silently overwrite each other and stock checks stay accurate.
    merged_quantities: dict[int, int] = {}
    for item in payload.items:
        merged_quantities[item.product_id] = merged_quantities.get(item.product_id, 0) + item.quantity

    products_by_id: dict[int, models.Product] = {}
    insufficient_stock_errors = []

    for product_id, quantity in merged_quantities.items():
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with id {product_id} not found.",
            )
        if product.quantity_in_stock < quantity:
            insufficient_stock_errors.append(
                f"'{product.name}' (SKU {product.sku}): requested {quantity}, "
                f"only {product.quantity_in_stock} in stock"
            )
        products_by_id[product_id] = product

    if insufficient_stock_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock for one or more products: " + "; ".join(insufficient_stock_errors),
        )

    # All validations passed - build the order, deduct stock, compute total.
    order = models.Order(customer_id=customer.id, status="confirmed")
    total_amount = 0.0

    for product_id, quantity in merged_quantities.items():
        product = products_by_id[product_id]
        unit_price = product.price

        order_item = models.OrderItem(
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
        )
        order.items.append(order_item)

        product.quantity_in_stock -= quantity
        total_amount += unit_price * quantity

    order.total_amount = round(total_amount, 2)

    db.add(order)
    db.commit()
    db.refresh(order)

    return _serialize_order(order)


@router.get("", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = (
        db.query(models.Order)
        .options(joinedload(models.Order.items).joinedload(models.OrderItem.product), joinedload(models.Order.customer))
        .order_by(models.Order.id.desc())
        .all()
    )
    return [_serialize_order(o) for o in orders]


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items).joinedload(models.OrderItem.product), joinedload(models.Order.customer))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
    return _serialize_order(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    """
    Cancels (deletes) an order and restocks the products involved, since an
    order cancellation should not permanently lose inventory.
    """
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    for item in order.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if product:
            product.quantity_in_stock += item.quantity

    db.delete(order)
    db.commit()
    return None


def _serialize_order(order: models.Order) -> schemas.OrderOut:
    return schemas.OrderOut(
        id=order.id,
        customer_id=order.customer_id,
        customer_name=order.customer.full_name if order.customer else None,
        total_amount=order.total_amount,
        status=order.status,
        created_at=order.created_at,
        items=[
            schemas.OrderItemOut(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else None,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            for item in order.items
        ],
    )
