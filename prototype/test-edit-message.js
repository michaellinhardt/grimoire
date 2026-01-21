#!/usr/bin/env node
/**
 * Test message editing with hybrid session
 *
 * Flow:
 * 1. Send "hello"
 * 2. Send "my name is mike" -> AI says "hello mike"
 * 3. EDIT: Rewind to after "hello", send "my name is ilan" instead
 * 4. AI should say "hello ilan"
 */

const { GrimoireSession } = require('./hybrid-session')
const path = require('path')
const fs = require('fs')

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

async function main() {
  console.log('='.repeat(60))
  console.log('GRIMOIRE MESSAGE EDIT TEST')
  console.log('='.repeat(60))

  const testDir = path.join(__dirname, 'test-workspace')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }

  const session = new GrimoireSession({
    cwd: testDir,
    debug: true
  })

  try {
    // Step 1: Send "hello"
    console.log('\n--- STEP 1: Send "hello" ---')
    let messages = await collectMessages(session.sendMessage('hello'))
    console.log('Response:', getResultText(messages))

    const checkpoints = session.getRewindPoints()
    console.log('Checkpoints so far:', checkpoints.length)
    const checkpoint1 = checkpoints[0]?.uuid
    console.log('Checkpoint after "hello":', checkpoint1)

    // Step 2: Send "my name is mike"
    console.log('\n--- STEP 2: Send "my name is mike" ---')
    messages = await collectMessages(session.sendMessage('my name is mike'))
    const mikeResponse = getResultText(messages)
    console.log('Response:', mikeResponse)
    console.log('Contains "mike"?', mikeResponse.toLowerCase().includes('mike') ? 'YES' : 'NO')

    // Step 3: EDIT - Rewind to after "hello" (checkpoint1)
    console.log('\n--- STEP 3: EDIT - Rewind to after "hello" ---')
    console.log('Rewinding to checkpoint:', checkpoint1)
    await session.rewind(checkpoint1, { rewindFiles: false, fork: true })
    console.log('New session:', session.getSessionId())

    // Step 4: Send the EDITED message "my name is ilan"
    console.log('\n--- STEP 4: Send EDITED message "my name is ilan" ---')
    messages = await collectMessages(session.sendMessage('my name is ilan'))
    const ilanResponse = getResultText(messages)
    console.log('Response:', ilanResponse)
    console.log('Contains "ilan"?', ilanResponse.toLowerCase().includes('ilan') ? 'YES' : 'NO')

    // Step 5: Verify - ask "what is my name?"
    console.log('\n--- STEP 5: Verify - "what is my name?" ---')
    messages = await collectMessages(session.sendMessage('what is my name?'))
    const nameResponse = getResultText(messages)
    console.log('Response:', nameResponse)

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(
      'Original (mike):',
      mikeResponse.toLowerCase().includes('mike') ? 'Said mike' : 'UNEXPECTED'
    )
    console.log(
      'After edit (ilan):',
      ilanResponse.toLowerCase().includes('ilan') ? 'Said ilan' : 'UNEXPECTED'
    )
    console.log(
      'Name check:',
      nameResponse.toLowerCase().includes('ilan')
        ? 'ILAN - SUCCESS'
        : nameResponse.toLowerCase().includes('mike')
          ? 'MIKE - FAIL'
          : 'UNCLEAR'
    )
    console.log('')
    console.log(
      'Message edit flow:',
      ilanResponse.toLowerCase().includes('ilan') && nameResponse.toLowerCase().includes('ilan')
        ? 'SUCCESS'
        : 'NEEDS INVESTIGATION'
    )
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  }
}

main()
