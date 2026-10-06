import { EChapeteRole, IChapeteAnswer, IChapeteMessage } from '../common/ChapeteTypes'

/** One bubble of the conversation, as the tab draws it. */
export interface IChapeteEntry {
    role: EChapeteRole
    content: string
    /**
     * Present while the answer is IN FLIGHT: the bubble shows 'Thinking...' and is completed when the
     * answer with this id arrives.
     */
    pendingId?: string
    /** the bubble is an error, not something the model said: it is shown but never sent back to it */
    error?: boolean
    /** the error is a usage limit reached */
    usageLimit?: boolean
}

export interface IChapeteData {
    /** the conversation, oldest first. It lives only here (PRD, D5): closing the tab loses it */
    entries: IChapeteEntry[]
    /** the channel's system prompt, as the back end last reported it */
    system: string
    /** signals still to be shown as text (instance lost, a command that failed...) */
    signals: string[]
    /**
     * What is being typed. It lives here and not in React state because the tab unmounts when switching
     * tabs, and losing a half-written question just for going to look at something else must not happen.
     */
    draft: string
    started: boolean
}

export class ChapeteData implements IChapeteData {
    entries: IChapeteEntry[] = []
    system = ''
    signals: string[] = []
    draft = ''
    started = false
}

/**
 * What is sent to the model: the conversation without the errors and without the bubble still waiting.
 * An error is Kwirth talking, not the model, and sending it back would make the model answer to it.
 */
export const conversationOf = (entries: IChapeteEntry[]): IChapeteMessage[] =>
    entries
        .filter(e => !e.error && !e.pendingId)
        .map(e => ({ role: e.role, content: e.content }))

/** true while some question has not been answered yet */
export const isThinking = (entries: IChapeteEntry[]): boolean => entries.some(e => e.pendingId !== undefined)

/**
 * The bubble that was waiting for this answer gets its text, or becomes the error that explains why not.
 * An answer nobody is waiting for (the conversation was cleared meanwhile) is dropped.
 */
export const completeAnswer = (entries: IChapeteEntry[], answer: IChapeteAnswer): void => {
    const entry = entries.find(e => e.pendingId === answer.id)
    if (!entry) return
    delete entry.pendingId
    if (answer.error !== undefined) {
        entry.content = answer.error
        entry.error = true
        if (answer.usageLimit) entry.usageLimit = true
    }
    else {
        entry.content = answer.text ?? ''
    }
}

/** Whatever was in flight is not going to answer any more: it is said, instead of thinking forever. */
export const abandonPending = (entries: IChapeteEntry[]): void => {
    for (const entry of entries) {
        if (entry.pendingId !== undefined) {
            delete entry.pendingId
            entry.content = 'No answer: the channel was stopped before the model replied.'
            entry.error = true
        }
    }
}
