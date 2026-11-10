import { useEffect, useState } from 'react'
import { SAMPLE_RESUME } from '@r4u/shared'
import type { TemplateMeta } from '@r4u/shared'
import { apiGet } from '@/lib/api'

// every preview is the sample resume: a gallery never renders a user's document
export function sampleFor(template: TemplateMeta) {
  return {
    ...SAMPLE_RESUME,
    templateKey: template.baseKey,
    design: { ...SAMPLE_RESUME.design, ...template.defaults },
  }
}

export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateMeta[] | null>(null)
  useEffect(() => {
    apiGet<{ templates: TemplateMeta[] }>('/templates')
      .then(({ templates: list }) => setTemplates(list))
      .catch(() => setTemplates([]))
  }, [])
  return templates
}
