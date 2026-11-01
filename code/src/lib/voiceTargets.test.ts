import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { asksToGoBack, matchLabel, pointsAtSomething } from './voiceTargets.ts'

describe('matchLabel', () => {
  it('finds a control by what it is called', () => {
    assert.equal(matchLabel('take me to the rooftop', ['Main Hall', 'Rooftop']), 1)
    assert.equal(matchLabel('Main hall please', ['Main Hall', 'Rooftop']), 0)
  })

  it('ignores punctuation, case and filler words', () => {
    assert.equal(matchLabel("what's the DRESS code?", ['Music', 'Dress code']), 1)
    assert.equal(matchLabel("let's go vampire", ['Witch couture', 'Let’s go vampire']), 1)
  })

  it('prefers the more specific of two full matches', () => {
    assert.equal(matchLabel('dress code rules', ['Dress', 'Dress code']), 1)
  })

  it('does not press something on one shared word', () => {
    assert.equal(matchLabel('what is the weather', ['What’s the music?']), null)
    assert.equal(matchLabel('we need money', ['We need costumes']), null)
  })

  it('finds nothing in an empty sentence or among empty labels', () => {
    assert.equal(matchLabel('', ['Music']), null)
    assert.equal(matchLabel('music', ['', '   ']), null)
  })
})

describe('pointsAtSomething', () => {
  it('hears a bare "that one"', () => {
    assert.equal(pointsAtSomething('that one'), true)
    assert.equal(pointsAtSomething('go there'), true)
    assert.equal(pointsAtSomething('show me this'), true)
  })

  it('leaves a sentence that names its own subject alone', () => {
    assert.equal(pointsAtSomething('take me to that rooftop'), false)
    assert.equal(pointsAtSomething('music'), false)
  })
})

describe('asksToGoBack', () => {
  it('hears the ways of stepping back, but not words containing them', () => {
    assert.equal(asksToGoBack('go back'), true)
    assert.equal(asksToGoBack('leave'), true)
    assert.equal(asksToGoBack('blackjack'), false)
  })
})
