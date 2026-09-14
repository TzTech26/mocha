import { A } from '@solidjs/router'
import { For, Show } from 'solid-js'
import { answerParts, faq } from '../lib/seo'

// The questions and the answers live in lib/seo.ts, because the same sentences
// are handed to Google as structured data. Rich results are only allowed to say
// what the page says, so there is one copy of the copy and this renders it.
export default function FAQ() {
  return (
    <div class="flex flex-col gap-4 p-8">
      <h1 class="-mt-2 pb-2 text-4xl font-bold">FAQ</h1>
      <For each={faq}>
        {(entry) => (
          <div class="collapse collapse-arrow bg-base-200">
            <input type="checkbox" name="faq" />
            <div class="collapse-title text-xl font-medium">{entry.question}</div>
            <div class="collapse-content">
              <p>
                <For each={answerParts(entry.answer)}>
                  {(part) => (
                    <Show when={'href' in part && part.href} fallback={part.text}>
                      {(href) => (
                        <A href={href()} class="underline underline-offset-2">
                          {part.text}
                        </A>
                      )}
                    </Show>
                  )}
                </For>
              </p>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
