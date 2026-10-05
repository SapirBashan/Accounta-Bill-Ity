'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

type SortableCategoryListProps<T> = {
  items: T[];
  onReorder: (items: T[]) => void;
  children: (item: T) => React.ReactNode;
  getId?: (item: T) => string;
  className?: string;
};

function uniqueItems<T>(items: T[], getId: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = getId(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function defaultGetId<T>(item: T) {
  return (item as { id: string }).id;
}

export default function SortableCategoryList<T>({
  items,
  onReorder,
  children,
  getId = defaultGetId,
  className = 'gap-3',
}: SortableCategoryListProps<T>) {
  const [orderedItems, setOrderedItems] = useState(() => uniqueItems(items, getId));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const pressRef = useRef<{ id: string; pointerId: number; x: number; y: number } | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // The parent replaces items after a server refresh or a saved reorder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedItems(uniqueItems(items, getId));
  }, [items, getId]);

  useEffect(() => () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  }, []);

  const moveItem = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const sourceIndex = orderedItems.findIndex((item) => getId(item) === sourceId);
    const targetIndex = orderedItems.findIndex((item) => getId(item) === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const nextItems = [...orderedItems];
    const [movedItem] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, movedItem);
    setOrderedItems(nextItems);
    onReorder(nextItems);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    const pointerId = event.pointerId;
    pressRef.current = {
      id,
      pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    dragButtonRef.current = event.currentTarget;

    const beginDrag = () => {
      const button = dragButtonRef.current;
      if (!button || pressRef.current?.pointerId !== pointerId) return;
      draggingIdRef.current = id;
      setDraggingId(id);
      button.setAttribute('aria-pressed', 'true');
      if (!button.hasPointerCapture(pointerId)) {
        button.setPointerCapture(pointerId);
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(30);
      }
      pressTimerRef.current = null;
    };

    if (event.pointerType === 'touch') {
      pressTimerRef.current = setTimeout(beginDrag, 500);
    } else {
      beginDrag();
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (press?.pointerId === event.pointerId && !draggingIdRef.current) {
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (moved > 10) {
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
        pressRef.current = null;
        dragButtonRef.current = null;
      }
      return;
    }
    if (!draggingIdRef.current) return;

    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-category-id]');
    if (target?.dataset.categoryId) {
      moveItem(draggingIdRef.current, target.dataset.categoryId);
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (pressRef.current?.pointerId === event.pointerId && pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pressTimerRef.current = null;
    pressRef.current = null;
    dragButtonRef.current = null;
    draggingIdRef.current = null;
    setDraggingId(null);
    event.currentTarget.setAttribute('aria-pressed', 'false');
  };

  return (
    <div className={`grid grid-cols-2 ${className}`}>
      {uniqueItems(orderedItems, getId).map((item) => (
        <div
          key={getId(item)}
          data-category-id={getId(item)}
          className={draggingId === getId(item) ? 'opacity-50' : ''}
        >
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              aria-label="לחיצה ארוכה לסידור קטגוריה"
              onPointerDown={(event) => handlePointerDown(event, getId(item))}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              title="לחיצה ארוכה לסידור קטגוריות"
              className="touch-pan-y select-none cursor-grab rounded-lg border-2 border-retro-border/20 px-1 text-retro-border/50 hover:bg-retro-yellow active:cursor-grabbing"
            >
              <GripVertical size={18} />
            </button>
            <div className="min-w-0 flex-1">{children(item)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}