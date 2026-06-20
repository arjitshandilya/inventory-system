export function Field({ label, error, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error ? <div className="field__error">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}

export function TextInput({ error, ...rest }) {
  return <input className={error ? "has-error" : ""} {...rest} />;
}
