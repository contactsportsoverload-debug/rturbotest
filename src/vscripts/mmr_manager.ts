// mmr_manager.ts — Manages MMR (GET/PUT) with minimal logs and [FIREBASE] prefix
// Adds cache-busting on GET to avoid stale values.

export class MMRManager {
  private firebase_url: string = "https://rankedturbo-default-rtdb.asia-southeast1.firebasedatabase.app";
  private readonly BASELINE = 500 as const;
  private firebaseLogged = false; // To avoid duplicate "working" logs

  constructor() {
    print("[MMR] MMRManager constructed");
  }

  private sendHTTPRequest(
    options: { url: string; method: "GET" | "PUT"; headers?: Record<string, string>; body?: string },
    cb: (res: { StatusCode: number; Body?: string } | null) => void
  ): void {
    const req = CreateHTTPRequestScriptVM(options.method, options.url);
    // Basic headers
    req.SetHTTPRequestHeaderValue("Accept", "application/json");
    // Strong no-cache headers to defeat intermediaries
    req.SetHTTPRequestHeaderValue("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate");
    req.SetHTTPRequestHeaderValue("Pragma", "no-cache");
    req.SetHTTPRequestHeaderValue("If-Modified-Since", "Mon, 01 Jan 1990 00:00:00 GMT");

    if (options.headers) {
      for (const k in options.headers) req.SetHTTPRequestHeaderValue(k, options.headers[k]);
    }
    if (options.method === "PUT" && options.body !== undefined) {
      req.SetHTTPRequestRawPostBody("application/json", options.body);
    }

    req.Send((res) => {
      const ok = !!res && res.StatusCode >= 200 && res.StatusCode < 300;
      if (ok && !this.firebaseLogged) {
        print("[FIREBASE] Firebase working");
        this.firebaseLogged = true;
      }
      if (!ok) {
        print("[FIREBASE] Firebase not working");
      }
      cb(ok ? res! : null);
    });
  }

  // Tiny helper to make unique cache-buster tokens
  private cacheBust(): string {
    // Use game time + random to avoid collisions
    return tostring(GameRules.GetGameTime()) + "_" + tostring(RandomInt(1, 1000000));
  }

  public GetOrCreatePlayerMMRAsync(steamAccountID: string, callback: (mmr: number) => void): void {
    // Append a cache-busting query param to defeat any HTTP caching
    const url = `${this.firebase_url}/mmr/${steamAccountID}.json?cb=${this.cacheBust()}`;

    this.sendHTTPRequest({ url, method: "GET" }, (result) => {
      const ok = !!result && result.StatusCode === 200 && result.Body !== undefined;
      const body = ok ? `${result!.Body}` : "null";
      const parsed = Number(body);
      const exists = body !== "null" && parsed === parsed; // NaN check via self-compare

      if (exists) {
        callback(parsed);
        return;
      }

      this.putMMR(steamAccountID, this.BASELINE, () => {
        callback(this.BASELINE);
      });
    });
  }

  public UpdatePlayerMMRAsync(steamAccountID: string, newMMR: number, callback?: (v: number) => void): void {
    if (steamAccountID === "0") {
      if (callback) callback(this.BASELINE);
      return;
    }
    this.putMMR(steamAccountID, newMMR, () => {
      if (callback) callback(newMMR);
    });
  }

  private putMMR(steamAccountID: string, value: number, cb?: (success: boolean) => void): void {
    const url = `${this.firebase_url}/mmr/${steamAccountID}.json`;
    const body = tostring(value);
    this.sendHTTPRequest(
      { url, method: "PUT", headers: { ["Content-Type"]: "application/json" }, body },
      (res) => {
        const success = !!res && res.StatusCode >= 200 && res.StatusCode < 300;
        if (cb) cb(success);
      }
    );
  }
}
