import type { MemberDto } from '@cordee/shared';
import clsx from 'clsx';
import { type KeyboardEvent, useRef, useState } from 'react';
import { Avatar } from '@/ui/Avatar';
import { Textarea } from '@/ui/Field';
import { pendingMention, PENDING_MENTION } from './mentions';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  members: MemberDto[];
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
}


export function MentionTextarea({ value, onChange, onSubmit, members, placeholder, label, autoFocus }: Props) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  const matches =
    query === null
      ? []
      : members.filter(({ user }) => user.name.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);

  function detect(text: string, caret: number) {
    setQuery(pendingMention(text, caret));
    setCursor(0);
  }

  function insert(name: string) {
    const textarea = field.current!;
    const caret = textarea.selectionStart;
    const before = value.slice(0, caret).replace(PENDING_MENTION, `$1@${name} `);
    onChange(before + value.slice(caret));
    setQuery(null);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(before.length, before.length);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (matches.length > 0) {
      if (event.key === 'ArrowDown') setCursor((cursor + 1) % matches.length);
      else if (event.key === 'ArrowUp') setCursor((cursor - 1 + matches.length) % matches.length);
      else if (event.key === 'Enter' || event.key === 'Tab') insert(matches[cursor]!.user.name);
      else if (event.key === 'Escape') setQuery(null);
      else return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onSubmit();
  }

  return (
    <div className="relative">
      <Textarea
        ref={field}
        value={value}
        rows={3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => {
          onChange(event.target.value);
          detect(event.target.value, event.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setQuery(null)}
      />
      {matches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Mentionner un membre"
          className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lift"
        >
          {matches.map(({ user }, index) => (
            <li key={user.id} role="option" aria-selected={index === cursor}>
              <button
                type="button"
                // mousedown : avant que le champ ne perde le focus et ne ferme la liste.
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(user.name);
                }}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                  index === cursor && 'bg-gentiane-soft',
                )}
              >
                <Avatar name={user.name} size="sm" /> {user.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
