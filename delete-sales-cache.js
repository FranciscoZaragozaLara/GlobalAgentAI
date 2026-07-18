const { S3Client, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: 'D:/Arcadevs/GlobalDMS/GlobalAgentAI/.env' });

async function run() {
  const client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const bucket = process.env.AWS_S3_BUCKET || 'global-agent-ai';
  const keys = [
    'reports/reporte-ejecutivo-basica-jetour_soueast_dealer_demo-julio_2026-2026.pdf',
    'reports/reporte-ejecutivo-basica-jetour_soueast_dealer_demo-julio_2026-2026-no-images.pdf',
    'unified/unified-report-basica-jetour_soueast_dealer_demo-julio_2026-2026.md'
  ];

  console.log(`Deleting ${keys.length} Sales cache files from S3 bucket: ${bucket}...`);
  try {
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map(k => ({ Key: k })),
        Quiet: false
      }
    });

    const response = await client.send(command);
    console.log('Successfully deleted sales cache:');
    (response.Deleted || []).forEach(d => console.log(` - ${d.Key}`));
  } catch (err) {
    console.error('Error deleting sales cache:', err.message);
  }
}
run();
