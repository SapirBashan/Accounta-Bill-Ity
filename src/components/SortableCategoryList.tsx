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
  const touchDragging = useRef(false);

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

  const handleTouchStart = (event: React.TouchEvent, id: string) => {
    event.preventDefault();
    touchDragging.current = true;
    setDraggingId(id);
    event.currentTarget.setAttribute('aria-pressed', 'true');
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (!touchDragging.current) return;

    event.preventDefault();
    const touch = event.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
      ?.closest<HTMLElement>('[data-category-id]');
    if (target?.dataset.categoryId && draggingId) {
      moveItem(draggingId, target.dataset.categoryId);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    touchDragging.current = false;
    setDraggingId(null);
    event.currentTarget.setAttribute('aria-pressed', 'false');
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {uniqueItems(orderedItems, getId).map((item) => (
        <div
          key={getId(item)}
          data-category-id={getId(item)}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggingId) moveItem(draggingId, getId(item));
          }}
          onDrop={() => {
            if (draggingId) moveItem(draggingId, getId(item));
            setDraggingId(null);
          }}
          className={draggingId === getId(item) ? 'opacity-50' : ''}
        >
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              draggable
              aria-label="גרור קטגוריה"
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', getId(item));
                setDraggingId(getId(item));
              }}
              onDragEnd={() => setDraggingId(null)}
              onTouchStart={(event) => handleTouchStart(event, getId(item))}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
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