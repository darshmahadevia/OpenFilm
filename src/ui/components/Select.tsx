import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

export interface SelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export interface SelectProps {
  align?: 'start' | 'end';
  className?: string;
  disabled?: boolean;
  label: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  restoreFocusOnSelect?: boolean;
  value: string;
}

export function Select({
  align = 'start',
  className = '',
  disabled = false,
  label,
  onValueChange,
  options,
  restoreFocusOnSelect = true,
  value,
}: SelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'above' | 'below'>('below');
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [focusedIndex, setFocusedIndex] = useState(selectedIndex);
  const selectedOption = options[selectedIndex] ?? options[0];

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const list = listRef.current;
    if (!trigger || !list) return;

    const spaceBelow = window.innerHeight - trigger.bottom;
    const spaceAbove = trigger.top;
    setPlacement(
      spaceBelow < Math.min(list.scrollHeight + 12, 280) && spaceAbove > spaceBelow
        ? 'above'
        : 'below',
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  useEffect(
    () => () => {
      if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
    },
    [],
  );

  function firstEnabledIndex(direction: 1 | -1, fromIndex: number) {
    for (let offset = 1; offset <= options.length; offset += 1) {
      const candidate = (fromIndex + direction * offset + options.length) % options.length;
      if (!options[candidate]?.disabled) return candidate;
    }
    return fromIndex;
  }

  function openList(direction?: 1 | -1) {
    if (disabled || options.length === 0) return;
    const nextIndex = direction
      ? firstEnabledIndex(direction, selectedIndex - direction)
      : selectedIndex;
    setFocusedIndex(nextIndex);
    setOpen(true);
  }

  function closeList(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function selectOption(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onValueChange(option.value);
    closeList(restoreFocusOnSelect);
  }

  function runTypeahead(key: string) {
    typeaheadRef.current += key.toLocaleLowerCase();
    if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadRef.current = '';
    }, 500);

    const match = options.findIndex(
      (option) =>
        !option.disabled && option.label.toLocaleLowerCase().startsWith(typeaheadRef.current),
    );
    if (match >= 0) setFocusedIndex(match);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (open) {
        setFocusedIndex((current) =>
          firstEnabledIndex(event.key === 'ArrowDown' ? 1 : -1, current),
        );
      } else {
        openList(event.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }
    if (open && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      const edge = event.key === 'Home' ? -1 : options.length;
      setFocusedIndex(firstEnabledIndex(event.key === 'Home' ? 1 : -1, edge));
      return;
    }
    if (open && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectOption(focusedIndex);
      return;
    }
    if (open && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeList(true);
      return;
    }
    if (event.key === 'Tab') {
      closeList();
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      if (!open) openList();
      runTypeahead(event.key);
    }
  }

  const classes = ['custom-select', `custom-select--${align}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes} ref={rootRef}>
      <button
        aria-activedescendant={open ? `${id}-option-${focusedIndex}` : undefined}
        aria-controls={`${id}-listbox`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className="custom-select__trigger"
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span>{selectedOption?.label ?? ''}</span>
        <svg aria-hidden="true" viewBox="0 0 12 8">
          <path d="m1 1 5 5 5-5" />
        </svg>
      </button>
      {open ? (
        <div
          aria-label={`${label} options`}
          className={`custom-select__listbox custom-select__listbox--${placement}`}
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
        >
          {options.map((option, index) => (
            <div
              aria-disabled={option.disabled || undefined}
              aria-selected={option.value === value}
              className="custom-select__option"
              data-highlighted={focusedIndex === index || undefined}
              id={`${id}-option-${index}`}
              key={option.value}
              onClick={() => selectOption(index)}
              onPointerMove={() => setFocusedIndex(index)}
              role="option"
            >
              <span>{option.label}</span>
              {option.value === value ? (
                <svg aria-hidden="true" viewBox="0 0 12 10">
                  <path d="m1 5 3 3 7-7" />
                </svg>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
