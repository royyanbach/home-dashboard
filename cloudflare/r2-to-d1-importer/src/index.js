/** Public endpoint: GET the Worker URL to import all R2 objects into D1. */
const PAGE_SIZE = 100;

async function insertObject(env, object) {
  await env.DB.prepare(
    `
    INSERT INTO "home-automation-clips" (file_name, created_at)
    VALUES (?, ?)
    ON CONFLICT(file_name) DO UPDATE SET created_at = excluded.created_at
  `,
  )
    .bind(object.key, object.uploaded.toISOString())
    .run();
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET') return new Response('Use GET', { status: 405 });
    const key = new URL(request.url).searchParams.get('key');

    if (key) {
      const object = await env.BUCKET.head(key);
      if (!object) return Response.json({ error: 'R2 object not found', key }, { status: 404 });
      await insertObject(env, object);
      return Response.json({
        inserted: true,
        file_name: object.key,
        created_at: object.uploaded.toISOString(),
      });
    }

    let cursor;
    let imported = 0;
    do {
      const page = await env.BUCKET.list({ cursor, limit: PAGE_SIZE });
      const statements = page.objects.map((object) =>
        env.DB.prepare(
          `
        INSERT INTO "home-automation-clips" (file_name, created_at)
        VALUES (?, ?)
        ON CONFLICT(file_name) DO UPDATE SET created_at = excluded.created_at
      `,
        ).bind(object.key, object.uploaded.toISOString()),
      );
      if (statements.length > 0) await env.DB.batch(statements);

      imported += page.objects.length;
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);

    return Response.json({ complete: true, imported });
  },
};
