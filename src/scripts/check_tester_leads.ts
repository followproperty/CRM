import mongoose from 'mongoose';
import dbConnect from '../lib/db';

async function run() {
  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) {
    console.error('DB reference not found.');
    process.exit(1);
  }

  // 1. Find the tester user
  const usersCol = db.collection('users');
  const tester = await usersCol.findOne({ 
    $or: [
      { name: /tester/i },
      { email: /tester/i }
    ]
  });

  if (!tester) {
    console.log('No user with name/email "tester" found.');
    process.exit(0);
  }

  console.log(`Found User: Name: "${tester.name}" | Email: "${tester.email}" | ID: ${tester._id}`);

  // 2. Query lead_containers for leads assigned to this user
  const leadContainers = db.collection('lead_containers');
  const assignedLeads = await leadContainers.find({ assignedTo: tester._id }).toArray();

  console.log(`\nTotal leads assigned to tester in lead_containers: ${assignedLeads.length}`);
  
  assignedLeads.forEach((lead, i) => {
    const details = lead.sourceDetails || {};
    const pitch = details.personalizedPitch || 'None';
    console.log(`${i + 1}. Name: "${lead.name}"`);
    console.log(`   Status: "${lead.status}"`);
    console.log(`   Source Collection: "${lead.sourceCollection || 'leads'}"`);
    console.log(`   AI Pitch: "${pitch}"`);
    console.log('   ---');
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
