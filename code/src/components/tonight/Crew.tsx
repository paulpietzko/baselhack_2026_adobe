import { useEffect, useRef } from 'react'
import ClaudeLogo from '../ClaudeLogo'
import { CREW, type CrewId } from '../../data/tonight'

export type Message = { id: number; from: CrewId | 'claude'; text: string }

const member = (id: CrewId) => CREW.find((c) => c.id === id)!

export function Avatar({ id, size = 22 }: { id: CrewId; size?: number }) {
  const { initials, name, color } = member(id)
  return (
    <span
      title={name}
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-black/30"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  )
}

export function CrewStack({ ids = CREW.map((c) => c.id), size = 22 }: { ids?: CrewId[]; size?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {ids.map((id) => (
        <Avatar key={id} id={id} size={size} />
      ))}
    </span>
  )
}

/** The group chat stays beside the world, so the plan is always made together */
export function Thread({ messages }: { messages: Message[] }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => void end.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length])

  return (
    <div className="pointer-events-none absolute top-14 bottom-4 left-4 z-10 flex w-72 flex-col [mask-image:linear-gradient(to_bottom,transparent,#000_72px)]">
      <div className="pointer-events-auto mt-auto flex flex-col gap-2 overflow-y-auto pt-16 [scrollbar-width:none]">
        {messages.map((m) =>
          m.from === 'claude' ? (
            <div key={m.id} className="spatial-glass animate-card-in flex gap-2 rounded-2xl p-3 font-serif text-[15px] leading-snug">
              <span className="mt-0.5 shrink-0"><ClaudeLogo size={16} /></span>
              <p>{m.text}</p>
            </div>
          ) : m.from === 'you' ? (
            <p key={m.id} className="animate-card-in ml-auto max-w-[85%] rounded-2xl bg-clay px-3 py-2 text-sm text-white">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="animate-card-in flex items-end gap-1.5">
              <Avatar id={m.from} />
              <p className="spatial-glass max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug">
                <span className="block text-[11px] font-semibold" style={{ color: member(m.from).color }}>
                  {member(m.from).name}
                </span>
                {m.text}
              </p>
            </div>
          ),
        )}
        <div ref={end} />
      </div>
    </div>
  )
}
