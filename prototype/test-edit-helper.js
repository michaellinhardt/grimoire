#!/usr/bin/env node
/**
 * Test the editMessage() helper
 */

const { GrimoireSession } = require('./hybrid-session');
const path = require('path');
const fs = require('fs');

async function collectMessages(generator) {
  const messages = [];
  for await (const msg of generator) {
    messages.push(msg);
  }
  return messages;
}

function getResultText(messages) {
  const result = messages.find(m => m.type === 'result');
  return result?.result || '';
}

async function main() {
  console.log('='.repeat(60));
  console.log('GRIMOIRE editMessage() HELPER TEST');
  console.log('='.repeat(60));

  const testDir = path.join(__dirname, 'test-workspace');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const session = new GrimoireSession({
    cwd: testDir,
    debug: false, // Less verbose
  });

  try {
    // Send messages
    console.log('\n1. Sending "hello"...');
    await collectMessages(session.sendMessage('hello'));

    console.log('2. Sending "my name is mike"...');
    let messages = await collectMessages(session.sendMessage('my name is mike'));
    const mikeCheckpoint = session.getRewindPoints()[1]?.uuid; // Second message
    console.log('   Response:', getResultText(messages));

    console.log('3. Verifying name...');
    messages = await collectMessages(session.sendMessage('what is my name?'));
    console.log('   Response:', getResultText(messages));

    // Now EDIT the "mike" message
    console.log('\n4. EDITING "my name is mike" → "my name is ilan"...');
    messages = await collectMessages(
      session.editMessage(mikeCheckpoint, 'my name is ilan')
    );
    console.log('   Response:', getResultText(messages));

    // Verify the edit worked
    console.log('\n5. Verifying edited name...');
    messages = await collectMessages(session.sendMessage('what is my name?'));
    const finalResponse = getResultText(messages);
    console.log('   Response:', finalResponse);

    console.log('\n' + '='.repeat(60));
    console.log('RESULT:', finalResponse.toLowerCase().includes('ilan') ? 'SUCCESS - Knows Ilan' : 'FAIL');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Test failed:', error);
  }
}

main();
