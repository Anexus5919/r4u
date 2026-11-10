import { useEffect } from 'react'

const TAGS = [
  { name: 'robots', content: 'noindex, nofollow' },
  { name: 'referrer', content: 'no-referrer' },
]

/** Marks the current page as never indexed and never sent as a referrer, for as long as it is shown. */
export function usePrivateDocument() {
  useEffect(() => {
    // the response header covers the HTML; these cover crawlers that render the app and outbound links
    const added = TAGS.map(({ name, content }) => {
      const meta = document.createElement('meta')
      meta.name = name
      meta.content = content
      document.head.appendChild(meta)
      return meta
    })
    return () => added.forEach((meta) => meta.remove())
  }, [])
}
