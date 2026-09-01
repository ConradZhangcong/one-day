import { X } from 'lucide-react';
import { type ChangeEvent, type CSSProperties, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export function Stack({
  children,
  className,
  direction = 'row',
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly direction?: 'row' | 'column';
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        direction === 'column' && 'flex-col items-start',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface Option<T extends string> {
  readonly value: T;
  readonly label: ReactNode;
}

export function SimpleSelect<T extends string>({
  allowClear = false,
  ariaLabel,
  className,
  multiple = false,
  onChange,
  options,
  placeholder,
  value,
}: {
  readonly allowClear?: boolean;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly multiple?: boolean;
  readonly onChange: (value: T | T[] | undefined) => void;
  readonly options: readonly Option<T>[];
  readonly placeholder?: string;
  readonly value?: T | readonly T[] | undefined;
}) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (multiple) {
      onChange(
        Array.from(event.currentTarget.selectedOptions, (option) => option.value as T),
      );
      return;
    }
    onChange(event.currentTarget.value ? (event.currentTarget.value as T) : undefined);
  };
  const normalizedValue = Array.isArray(value) ? value : (value ?? '');

  return (
    <NativeSelect
      aria-label={ariaLabel}
      className={cn('min-w-32', className)}
      multiple={multiple}
      value={normalizedValue}
      onChange={handleChange}
    >
      {!multiple && (placeholder || allowClear) ? (
        <NativeSelectOption value="">{placeholder ?? '清除选择'}</NativeSelectOption>
      ) : null}
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function ClearableInput({
  value,
  onChange,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative min-w-0">
      <Input
        className={cn(value && 'pr-8', props.className)}
        value={value}
        onChange={onChange}
        {...props}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          aria-label="清除输入"
          onClick={() =>
            onChange?.({ target: { value: '' } } as ChangeEvent<HTMLInputElement>)
          }
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ description }: { readonly description: ReactNode }) {
  return (
    <Empty className="min-h-44 border">
      <EmptyHeader>
        <EmptyTitle>暂无事项</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function LoadingState({ label = '正在加载…' }: { readonly label?: string }) {
  return (
    <div className="feature-loading" role="status">
      <Spinner aria-label={label} />
      {label}
    </div>
  );
}

export function TagBadge({
  children,
  color,
}: {
  readonly children: ReactNode;
  readonly color?: string;
}) {
  const style: CSSProperties | undefined = color
    ? { borderColor: color, color }
    : undefined;
  return (
    <Badge variant="outline" style={style}>
      {children}
    </Badge>
  );
}
