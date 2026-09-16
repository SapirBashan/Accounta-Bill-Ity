'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

type SortableCategoryListProps<T> = {
  items: T[];
  onReorder: (items: T[]) => void;
  children: (item: T) => React.ReactNode;
  getId?: (item: T) => string;
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

export default function SortableCategoryList<T>({
  items,
  onReorder,
  children,
  getId = (item) => (item as { id: string }).id,
}: SortableCategoryListProps<T>) {
  const [orderedItems, setOrderedItems] = useState(() => uniqueItems(items, getId));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    // The parent replaces items after a server refresh or a saved reorder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedItems(uniqueItems(items, getId));
  }, [items]);

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
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingIdRef.current = id;
    setDraggingId(id);
    event.currentTarget.setAttribute('aria-pressed', 'true');
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingIdRef.current) return;

    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-category-id]');
    if (target?.dataset.categoryId) {
      moveItem(draggingIdRef.current, target.dataset.categoryId);
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingIdRef.current = null;
    setDraggingId(null);
    event.currentTarget.setAttribute('aria-pressed', 'false');
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {uniqueItems(orderedItems, getId).map((item) => (
        <div
          key={getId(item)}
          data-category-id={getId(item)}
          className={draggingId === getId(item) ? 'opacity-50' : ''}
        >
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              aria-label="גרור קטגוריה"
              onPointerDown={(event) => handlePointerDown(event, getId(item))}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              className="touch-none select-none cursor-grab rounded-lg border-2 border-retro-border/20 px-1 text-retro-border/50 hover:bg-retro-yellow active:cursor-grabbing"
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