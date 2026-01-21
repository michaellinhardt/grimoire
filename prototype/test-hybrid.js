#!/usr/bin/env node
/**
 * Test the hybrid session manager
 *
 * Flow:
 * 1. Send message 1: "Remember the number 42"
 * 2. Send message 2: "Remember the number 99 instead"
 * 3. Ask: "What number?" -> Should say 99
 * 4. Rewind to message 1
 * 5. Ask: "What number?" -> Should say 42
 */

const { GrimoireSession } = require('./hybrid-session')
const path = require('path')

async function collectMessages(generator) {
  const messages = []
  for await (const msg of generator) {
    messages.push(msg)
  }
  return messages
}

function getResultText(messages) {
  const result = messages.find((m) => m.type === 'result')
  return result?.result || ''
}

function getAssistantText(messages) {
  const assistant = messages.filter((m) => m.type === 'assistant')
  let text = ''
  for (const msg of assistant) {
    if (msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          text += block.text
        }
      }
    }
  }
  return text
}

async function main() {
  console.log('='.repeat(60))
  console.log('GRIMOIRE HYBRID SESSION TEST')
  console.log('='.repeat(60))

  const session = new GrimoireSession({
    cwd: path.join(__dirname, 'test-workspace'),
    debug: true
  })

  // Create test workspace
  const fs = require('fs')
  const testDir = path.join(__dirname, 'test-workspace')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }

  try {
    // Step 1: First message
    console.log('\n--- STEP 1: Remember 42 ---')
    let messages = await collectMessages(
      session.sendMessage('Remember this number: 42. Just acknowledge.')
    )
    console.log('Response:', getResultText(messages))
    console.log('Session:', session.getSessionId())
    console.log('Checkpoints:', session.getRewindPoints().length)

    const checkpoint1 = session.getRewindPoints()[0]?.uuid
    console.log('Checkpoint 1 UUID:', checkpoint1)

    // Step 2: Second message (override)
    console.log('\n--- STEP 2: Remember 99 instead ---')
    messages = await collectMessages(
      session.sendMessage('Forget 42. Now remember 99 instead. Just acknowledge.')
    )
    console.log('Response:', getResultText(messages))
    console.log('Checkpoints:', session.getRewindPoints().length)

    // Step 3: Verify it remembers 99
    console.log('\n--- STEP 3: Verify (should be 99) ---')
    messages = await collectMessages(
      session.sendMessage('What number did I ask you to remember? Reply with just the number.')
    )
    const answer1 = getResultText(messages)
    console.log('Response:', answer1)
    console.log('Contains 99?', answer1.includes('99') ? 'YES' : 'NO')

    // Step 4: Rewind to checkpoint 1
    console.log('\n--- STEP 4: REWIND to checkpoint 1 ---')
    if (checkpoint1) {
      await session.rewind(checkpoint1, { rewindFiles: false, fork: true })
      console.log('New session after rewind:', session.getSessionId())
    } else {
      console.log('ERROR: No checkpoint to rewind to')
      return
    }

    // Step 5: Verify it now remembers 42
    console.log('\n--- STEP 5: Verify after rewind (should be 42) ---')
    messages = await collectMessages(
      session.sendMessage('What number did I ask you to remember? Reply with just the number.')
    )
    const answer2 = getResultText(messages)
    console.log('Response:', answer2)
    console.log('Contains 42?', answer2.includes('42') ? 'YES' : 'NO')

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    console.log('Before rewind (expected 99):', answer1.includes('99') ? 'PASS' : 'FAIL')
    console.log('After rewind (expected 42):', answer2.includes('42') ? 'PASS' : 'FAIL')
    console.log(
      'Hybrid flow:',
      answer1.includes('99') && answer2.includes('42') ? 'SUCCESS' : 'NEEDS INVESTIGATION'
    )
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

main()
