import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import type { UserNoteRepository } from './note-model';
import { useUserNote } from './use-user-note';

interface TweetUserNoteProps {
  handle: string;
  repository: UserNoteRepository;
  onVisibilityChange?: (visible: boolean) => void;
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

function NoteLabel({ handle, text }: { handle: string; text: string }) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasFocusRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  function clearCloseTimer() {
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  }

  function openTooltip() {
    clearCloseTimer();
    setIsOpen(true);
  }

  function closeTooltip() {
    clearCloseTimer();
    setIsOpen(false);
  }

  function scheduleClose() {
    clearCloseTimer();
    if (!hasFocusRef.current) {
      closeTimerRef.current = setTimeout(() => setIsOpen(false), 120);
    }
  }

  useEffect(() => () => clearCloseTimer(), []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const button = buttonRef.current;
    const tooltip = tooltipRef.current;
    if (!button || !tooltip || !tooltip.isConnected) {
      return;
    }

    // A top-layer popover escapes the overflow clipping in X's author header.
    try {
      tooltip.showPopover?.();
    } catch {
      // X can remove a recycled article between the event and this layout effect.
      return;
    }
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    tooltip.style.maxWidth = `${Math.min(320, Math.max(0, viewportWidth - 16))}px`;
    tooltip.style.maxHeight = `${Math.max(0, viewportHeight - 16)}px`;
    const anchor = button.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.left, viewportWidth - bounds.width - 8));
    const below = anchor.bottom + 8;
    const top = below + bounds.height <= viewportHeight - 8
      ? below
      : Math.max(8, anchor.top - bounds.height - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    function handleScroll(event: Event) {
      if (event.target instanceof Node && tooltip?.contains(event.target)) {
        return;
      }
      closeTooltip();
    }

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', closeTooltip);
    return () => {
      try {
        tooltip.hidePopover?.();
      } catch {
        // Removing the host may already have removed the popover from the top layer.
      }
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', closeTooltip);
    };
  }, [isOpen, text]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTooltip();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="te-tweet-note"
        aria-label={`查看 @${handle} 的私人备注`}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          hasFocusRef.current = true;
          openTooltip();
        }}
        onBlur={() => {
          hasFocusRef.current = false;
          closeTooltip();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openTooltip();
        }}
        onPointerDown={stopPropagation}
        onPointerUp={stopPropagation}
        onKeyDown={handleKeyDown}
        onKeyUp={stopPropagation}
      >
        {text.replace(/\s+/g, ' ').trim()}
      </button>
      <span
        ref={tooltipRef}
        id={tooltipId}
        className="te-tweet-note__tooltip"
        role="tooltip"
        popover="manual"
        hidden={!isOpen}
        style={{ position: 'fixed', inset: 'auto', margin: 0 }}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
        onClick={stopPropagation}
      >
        {text}
      </span>
    </>
  );
}

export function TweetUserNote({
  handle,
  repository,
  onVisibilityChange,
}: TweetUserNoteProps) {
  const { note, loadError } = useUserNote(repository, handle);
  const text = loadError ? '' : note?.text ?? '';
  const isVisible = text.trim().length > 0;

  useEffect(() => {
    onVisibilityChange?.(isVisible);
    return () => onVisibilityChange?.(false);
  }, [isVisible, onVisibilityChange]);

  return isVisible ? <NoteLabel key={handle} handle={handle} text={text} /> : null;
}
