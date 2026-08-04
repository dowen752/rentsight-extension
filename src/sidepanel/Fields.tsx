import type { SourcedValue, ValueSource } from '../calculations';

const SOURCE_LABELS: Record<ValueSource, string> = {
  listing: 'Extracted from listing',
  user: 'Entered by user',
  location_estimate: 'Estimated',
  default: 'Default assumption',
};

interface FieldFrameProps {
  label: string;
  field?: SourcedValue<unknown>;
  canReset: boolean;
  onReset: () => void;
  children: React.ReactNode;
}

function FieldFrame({
  label,
  field,
  canReset,
  onReset,
  children,
}: FieldFrameProps) {
  return (
    <div className="field">
      <div className="field-heading">
        <label>{label}</label>
        <span className={`source source-${field?.source ?? 'unknown'}`}>
          {field ? SOURCE_LABELS[field.source] : 'Missing'}
        </span>
      </div>
      <div className="input-row">
        {children}
        {field?.source === 'user' && (
          <button
            type="button"
            className="reset"
            onClick={onReset}
            disabled={!canReset}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  field?: SourcedValue<number>;
  baseline?: SourcedValue<number>;
  onChange: (value: number) => void;
  onReset: () => void;
  prefix?: string;
  step?: number;
  min?: number;
  disabled?: boolean;
}

export function NumberField({
  label,
  field,
  baseline,
  onChange,
  onReset,
  prefix,
  step = 1,
  min = 0,
  disabled = false,
}: NumberFieldProps) {
  return (
    <FieldFrame
      label={label}
      field={field}
      canReset={Boolean(baseline)}
      onReset={onReset}
    >
      {prefix && <span className="prefix">{prefix}</span>}
      <input
        aria-label={label}
        type="number"
        min={min}
        step={step}
        value={field?.value ?? ''}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value !== '') onChange(event.target.valueAsNumber);
        }}
      />
    </FieldFrame>
  );
}

interface TextFieldProps {
  label: string;
  field?: SourcedValue<string>;
  baseline?: SourcedValue<string>;
  onChange: (value: string) => void;
  onReset: () => void;
  type?: 'text' | 'url';
}

export function TextField({
  label,
  field,
  baseline,
  onChange,
  onReset,
  type = 'text',
}: TextFieldProps) {
  return (
    <FieldFrame
      label={label}
      field={field}
      canReset={Boolean(baseline)}
      onReset={onReset}
    >
      <input
        aria-label={label}
        type={type}
        value={field?.value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldFrame>
  );
}
