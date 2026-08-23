# R2 object index → D1

This standalone Worker imports every R2 object into the
`home-automation-clips` D1 table. R2 remains the durable store for file bytes.

1. Replace the three `REPLACE_WITH...` values in `wrangler.jsonc`. The
   `database_name` is the D1 database's human-readable name; `database_id` is
   its UUID.
2. In this directory, run `npm run migrate`, then `npm run deploy`. The
   migration command uses the configured `DB` binding rather than the UUID.
3. Deploy with `npm run deploy`, then open the deployed Worker URL in a browser
   or make a GET request:

   ```sh
   curl https://YOUR_WORKER.workers.dev
   ```

The response reports the number of objects imported. Running the GET endpoint
again is safe because `file_name` is unique. `created_at` is copied from each
R2 object's upload timestamp.

To insert just one object after uploading it to R2, call:

```sh
curl -f -G 'https://YOUR_WORKER.workers.dev' --data-urlencode 'key=clips/CAMERA/EVENT_ID.mp4'
```
