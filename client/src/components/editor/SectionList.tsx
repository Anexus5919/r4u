import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/cn'
import { Icon, SectionMark } from '@/components/ui/Icon'
import type { EditorSection } from '@/editor/types'

/*
  dnd-kit rather than react-beautiful-dnd, which is deprecated, or native HTML5 drag and drop,
  which has no touch support, no keyboard path and an unstyleable drag image.

  The keyboard sensor is the reason it is worth the dependency: reordering works from the
  keyboard with screen-reader announcements and no extra code.
*/

function SortableSection({
  section,
  active,
  findings,
  onSelect,
  onToggle,
}: {
  section: EditorSection
  active: boolean
  findings: number
  onSelect: () => void
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section._id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-10')}
    >
      {/*
        A 2px accent bar flush to the left edge marks the active section, never a filled row.
        A filled row reads as a selected cell in a table; a bar reads as a position in a document.
      */}
      <span
        aria-hidden
        className={cn(
          'absolute top-1 bottom-1 left-0 w-0.5',
          active ? 'bg-accent' : isDragging ? 'bg-ink-06' : 'bg-transparent'
        )}
      />

      <div className="flex items-center gap-1 pl-3">
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? 'true' : undefined}
          className={cn(
            't-xs flex flex-1 items-baseline gap-2.5 py-1.5 text-left text-sm transition-colors',
            active ? 'text-ink-12' : 'text-ink-09 hover:text-ink-11',
            // hidden stays visible and demoted, never removed: the user must see what they hid
            section.hidden && 'text-ink-07 line-through decoration-ink-06 decoration-1'
          )}
        >
          <SectionMark>{section.type}</SectionMark>
          <span className="truncate">{section.title}</span>

          {findings > 0 && !section.hidden ? (
            <span className="ml-auto shrink-0 font-mono text-2xs text-ink-07 tabular-nums">
              {findings}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-label={section.hidden ? `Show ${section.title}` : `Hide ${section.title}`}
          aria-pressed={section.hidden}
          className="t-xs text-ink-07 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Icon name={section.hidden ? 'eyeOff' : 'eye'} />
        </button>

        {/* the handle appears on hover only, so the resting list stays quiet */}
        <button
          type="button"
          aria-label={`Reorder ${section.title}`}
          className="t-xs cursor-grab text-ink-07 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" />
        </button>
      </div>
    </li>
  )
}

export function SectionList({
  sections,
  activeId,
  findingsBySection,
  onSelect,
  onToggle,
  onReorder,
}: {
  sections: EditorSection[]
  activeId: string | null
  findingsBySection: Record<string, number>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onReorder: (order: string[]) => void
}) {
  const sensors = useSensors(
    // a small distance so a click on the handle is not read as a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = sections.map((section) => section._id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return

    const next = [...ids]
    next.splice(to, 0, ...next.splice(from, 1))
    onReorder(next)
  }

  return (
    <nav aria-label="Resume sections">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={sections.map((section) => section._id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-1">
            {sections.map((section) => (
              <SortableSection
                key={section._id}
                section={section}
                active={section._id === activeId}
                findings={findingsBySection[section._id] ?? 0}
                onSelect={() => onSelect(section._id)}
                onToggle={() => onToggle(section._id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </nav>
  )
}
