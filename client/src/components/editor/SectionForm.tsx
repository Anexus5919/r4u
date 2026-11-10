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
import { SECTION_REGISTRY } from '@r4u/shared'
import type { Finding, FieldSpec } from '@r4u/shared'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Field'
import { newObjectId } from '@/editor/types'
import type { EditorEntry, EditorSection } from '@/editor/types'
import { BulletList, FieldControl } from './fields'

// forms come from SECTION_REGISTRY, so the counter's limits match the server's

function EntryFields({
  spec,
  entry,
  findings,
  onField,
}: {
  spec: FieldSpec[]
  entry: EditorEntry
  findings: Finding[]
  onField: (field: string, value: unknown) => void
}) {
  const bullets = spec.find((field) => field.type === 'bullets')
  const rest = spec.filter((field) => field.type !== 'bullets')

  // dates and short text pair naturally two across; everything else takes the full measure
  const paired = new Set(['startDate', 'endDate', 'location', 'grade', 'level', 'issuer'])

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {rest.map((field) => (
          <div key={field.key} className={cn(!paired.has(field.key) && 'sm:col-span-2')}>
            <FieldControl
              spec={field}
              value={entry.data[field.key]}
              onChange={(value) => onField(field.key, value)}
            />
          </div>
        ))}
      </div>

      {bullets ? (
        <BulletList
          spec={bullets}
          values={Array.isArray(entry.data.bullets) ? (entry.data.bullets as string[]) : []}
          onChange={(next) => onField('bullets', next)}
          findingsFor={(index) =>
            findings.filter((f) => f.field === 'bullets' && f.index === index)
          }
        />
      ) : null}
    </div>
  )
}

function SortableEntry({
  entry,
  index,
  section,
  findings,
  onField,
  onToggle,
  onRemove,
}: {
  entry: EditorEntry
  index: number
  section: EditorSection
  findings: Finding[]
  onField: (field: string, value: unknown) => void
  onToggle: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry._id,
  })

  const spec = SECTION_REGISTRY[section.type]

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // an entry is whitespace plus a hairline, never a nested card
      className={cn(
        'group border-t border-ink-04 pt-6 first:border-t-0 first:pt-0',
        isDragging && 'opacity-60'
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-mono text-2xs text-ink-07 tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            aria-pressed={entry.hidden}
            aria-label={entry.hidden ? 'Show this entry' : 'Hide this entry'}
          >
            <Icon name={entry.hidden ? 'eyeOff' : 'eye'} />
          </Button>

          <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Remove this entry">
            <Icon name="trash" />
          </Button>

          <button
            type="button"
            aria-label="Reorder this entry"
            className="t-xs flex h-7 w-7 cursor-grab items-center justify-center text-ink-07 transition-colors hover:text-ink-11"
            {...attributes}
            {...listeners}
          >
            <Icon name="grip" />
          </button>
        </div>
      </div>

      <div className={cn(entry.hidden && 'opacity-50')}>
        <EntryFields spec={spec.fields} entry={entry} findings={findings} onField={onField} />
      </div>
    </li>
  )
}

export function SectionForm({
  section,
  findings,
  onTitle,
  onField,
  onAddEntry,
  onRemoveEntry,
  onToggleEntry,
  onReorderEntries,
}: {
  section: EditorSection
  findings: Finding[]
  onTitle: (value: string) => void
  onField: (entryId: string, field: string, value: unknown) => void
  onAddEntry: (entryId: string) => void
  onRemoveEntry: (entryId: string) => void
  onToggleEntry: (entryId: string) => void
  onReorderEntries: (order: string[]) => void
}) {
  const spec = SECTION_REGISTRY[section.type]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = section.entries.map((entry) => entry._id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return

    const next = [...ids]
    next.splice(to, 0, ...next.splice(from, 1))
    onReorderEntries(next)
  }

  const atLimit = section.entries.length >= spec.maxEntries

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="section-title">Section heading</Label>
        <Input
          id="section-title"
          value={section.title}
          maxLength={60}
          onChange={(e) => onTitle(e.target.value)}
        />
        {spec.canonicalHeadings.length > 0 ? (
          <p className="text-xs text-ink-09">
            Parsers match sections by their heading text. Recognised here:{' '}
            {spec.canonicalHeadings.join(', ')}.
          </p>
        ) : null}
      </div>

      {section.entries.length === 0 ? (
        <div className="border-t border-ink-04 pt-6">
          <p className="text-sm text-ink-09">
            Nothing in this section yet.{' '}
            {section.type === 'summary'
              ? 'Add the one entry it holds.'
              : `Add up to ${spec.maxEntries}.`}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={section.entries.map((entry) => entry._id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-6">
              {section.entries.map((entry, index) => (
                <SortableEntry
                  key={entry._id}
                  entry={entry}
                  index={index}
                  section={section}
                  findings={findings.filter((f) => f.entryId === entry._id)}
                  onField={(field, value) => onField(entry._id, field, value)}
                  onToggle={() => onToggleEntry(entry._id)}
                  onRemove={() => onRemoveEntry(entry._id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {spec.repeatable || section.entries.length === 0 ? (
        <div className="border-t border-ink-04 pt-6">
          <Button onClick={() => onAddEntry(newObjectId())} disabled={atLimit}>
            <Icon name="plus" />
            {atLimit ? `Limit of ${spec.maxEntries} reached` : `Add ${spec.label.toLowerCase()}`}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
