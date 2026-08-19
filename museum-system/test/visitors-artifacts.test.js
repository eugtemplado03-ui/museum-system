const test = require('node:test');
const assert = require('node:assert/strict');
const visitors = require('../db/visitors');
const artifactLogs = require('../db/artifact-logs');

test('Visitor log CRUD and statistics workflow', async () => {
  // 1. Create visitor entries
  const v1 = visitors.create({
    visitorName: 'Maria Santos',
    groupName: 'Sagay National High School',
    groupType: 'School Tour',
    pax: 35,
    purpose: 'Educational Tour',
    tourGuide: 'Juan De La Cruz',
    status: 'Checked-in',
    contactNumber: '+63 917 111 2222',
    email: 'maria@snhs.edu.ph',
    notes: 'Grade 7 Marine Biology Class'
  });

  const v2 = visitors.create({
    visitorName: 'Dr. Robert Tan',
    groupName: 'UP Marine Science Institute',
    groupType: 'Researcher / Scholar',
    pax: 3,
    purpose: 'Research',
    status: 'Scheduled',
    notes: 'Coral reef specimens study'
  });

  assert.ok(v1.id, 'v1 should have an id');
  assert.equal(v1.visitorName, 'Maria Santos');
  assert.equal(v1.pax, 35);
  assert.equal(v1.groupType, 'School Tour');

  // 2. Query with search filter
  const searchRes = visitors.all({ search: 'Santos' });
  assert.ok(searchRes.some(v => v.id === v1.id), 'Search by visitor name should return v1');

  // 3. Query with group filter
  const schoolRes = visitors.all({ groupType: 'School Tour' });
  assert.ok(schoolRes.some(v => v.id === v1.id), 'Filter by School Tour should include v1');
  assert.ok(!schoolRes.some(v => v.id === v2.id), 'Filter by School Tour should not include v2');

  // 4. Update visitor entry
  const updated = visitors.update(v1.id, {
    status: 'Completed',
    notes: 'Tour finished smoothly at 11:30 AM'
  });
  assert.equal(updated.status, 'Completed');
  assert.equal(updated.notes, 'Tour finished smoothly at 11:30 AM');

  // 5. Test stats
  const statData = visitors.stats();
  assert.ok(statData.totalVisits >= 2, 'Total visits should reflect created items');
  assert.ok(statData.totalPax >= 38, 'Total pax should count headcount');
  assert.ok(statData.byGroupType['School Tour'] >= 35, 'Group pax breakdown should include School Tour');

  // 6. Remove visitor entry
  const rem1 = visitors.remove(v1.id);
  const rem2 = visitors.remove(v2.id);
  assert.equal(rem1, true, 'Remove v1 should succeed');
  assert.equal(rem2, true, 'Remove v2 should succeed');
  assert.equal(visitors.findById(v1.id), undefined, 'v1 should not be found');
});

test('Artifacts log CRUD, auto accession numbering, and statistics workflow', async () => {
  // 1. Create artifact logs
  const a1 = artifactLogs.create({
    name: 'Tridacna Gigas (Giant Clam) Shell Specimen',
    category: 'Marine Specimen',
    condition: 'Excellent',
    status: 'On Display',
    location: 'Marine Hall - Case 1A',
    donor: 'Sagay Marine Reserve',
    estimatedValue: '₱35,000',
    description: '45cm fossilized giant clam shell from Carbin Reef.'
  });

  const a2 = artifactLogs.create({
    name: 'Handcrafted Wooden Sungka Board (1960s)',
    category: 'Traditional Toy',
    condition: 'Needs Restoration',
    status: 'In Storage',
    location: 'Vault Shelf 3-B',
    donor: 'Donated by Locsin Family',
    notes: 'Requires wood preservation oil and minor crack repair.'
  });

  assert.ok(a1.id, 'a1 should have an id');
  assert.ok(a1.accessionNo.startsWith('MSBN-'), 'a1 should have generated accession number');
  assert.equal(a1.condition, 'Excellent');
  assert.equal(a1.status, 'On Display');

  // 2. Query with search filter
  const searchRes = artifactLogs.all({ search: 'Giant Clam' });
  assert.ok(searchRes.some(a => a.id === a1.id), 'Search should find giant clam');

  // 3. Query with condition filter
  const restoreRes = artifactLogs.all({ condition: 'Needs Restoration' });
  assert.ok(restoreRes.some(a => a.id === a2.id), 'Condition filter should find sungka board');

  // 4. Update artifact log
  const updated = artifactLogs.update(a2.id, {
    condition: 'Good',
    status: 'On Display',
    location: 'Heritage Toys Gallery'
  });
  assert.equal(updated.condition, 'Good');
  assert.equal(updated.status, 'On Display');

  // 5. Test stats
  const statData = artifactLogs.stats();
  assert.ok(statData.totalArtifacts >= 2, 'Total artifacts count should reflect items');
  assert.ok(statData.byCategory['Marine Specimen'] >= 1, 'Category stats should include Marine Specimen');

  // 6. Remove artifact logs
  const rem1 = artifactLogs.remove(a1.id);
  const rem2 = artifactLogs.remove(a2.id);
  assert.equal(rem1, true, 'Remove a1 should succeed');
  assert.equal(rem2, true, 'Remove a2 should succeed');
  assert.equal(artifactLogs.findById(a1.id), undefined, 'a1 should not be found');
});
