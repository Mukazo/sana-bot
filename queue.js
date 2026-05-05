const { Queue, QueueEvents, Job } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
};

const QUEUE_NAME = 'discord-tasks';

const queue = new Queue(QUEUE_NAME, { connection });
const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

const listeners = new Set();

function listenForResults(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

queueEvents.on('completed', async ({ jobId }) => {
  try {
    const job = await Job.fromId(queue, jobId);
    const result = await job.returnvalue;

    for (const cb of listeners) {
      cb(result);
    }
  } catch (err) {
    console.error('[QUEUE COMPLETED EVENT ERROR]', err);
  }
});

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  try {
    const job = await Job.fromId(queue, jobId);
    const payload = job?.data || {};

    for (const cb of listeners) {
      cb({
        ok: false,
        jobId: payload.jobId,
        error: failedReason
      });
    }
  } catch (err) {
    console.error('[QUEUE FAILED EVENT ERROR]', err);
  }
});

async function enqueueInteraction(jobName, payload) {
  return queue.add(jobName, payload, {
    removeOnComplete: true,
    removeOnFail: true,
  });
}

module.exports = {
  enqueueInteraction,
  listenForResults,
};