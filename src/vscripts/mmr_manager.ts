// vscripts/mmr_manager.ts

export class MMRManager {
    private firebase_url: string;

    constructor() {
    this.firebase_url = "https://rankedturbo-default-rtdb.asia-southeast1.firebasedatabase.app"; // no trailing slash
    CustomNetTables.SetTableValue("player_stats", "init", { mmr: 0 });
    }

    // --- HTTP helper using CreateHTTPRequestScriptVM ---
    private sendHTTPRequest(
        options: { url: string; method: "GET" | "PUT"; headers?: Record<string, string>; body?: string },
        cb: (res: { StatusCode: number; Body?: string }) => void
    ): void {
        const req = CreateHTTPRequestScriptVM(options.method, options.url);

        if (options.headers) {
            for (const k in options.headers) {
                req.SetHTTPRequestHeaderValue(k, options.headers[k]);
            }
        }
        if (options.method === "PUT" && options.body !== undefined) {
            // We send a raw JSON number as the body, e.g. "1234"
            req.SetHTTPRequestRawPostBody("application/json", options.body);
        }

        req.Send(cb);
    }

    // --- Public API ---

    // GET player's MMR (or initialize to 1000 if missing/error)
    public GetPlayerMMRAsync(steamID: string, callback: (mmr: number) => void): void {
        const url = `${this.firebase_url}/mmr/${steamID}.json`;

        this.sendHTTPRequest({ url, method: "GET" }, (result) => {
            let mmr = 1000;

            if (result && result.StatusCode === 200 && result.Body && result.Body.length > 0) {
                const parsed = Number(result.Body as any); // transpiles to tonumber(...)
                if (parsed !== undefined && parsed !== null && parsed === parsed) { // not NaN
                    mmr = parsed;
                } else {
                    // initialize remote if body wasn't a number
                    this.UpdatePlayerMMRAsync(steamID, mmr);
                }
            } else {
                // missing or error → initialize remotely
                this.UpdatePlayerMMRAsync(steamID, mmr);
            }

            callback(mmr);
        });
    }

    // PUT a new numeric value (stored as a raw JSON number, not an object)
    public UpdatePlayerMMRAsync(steamID: string, newMMR: number, callback?: (v: number) => void): void {
        const url = `${this.firebase_url}/mmr/${steamID}.json`;
        const body = tostring(newMMR); // raw number JSON (e.g., 1234)

        this.sendHTTPRequest(
            {
                url,
                method: "PUT",
                headers: { ["Content-Type"]: "application/json" },
                body,
            },
            (_) => {
                if (callback) callback(newMMR);
            }
        );
    }

    // Load → adjust → save
    public AdjustPlayerMMRAsync(steamID: string, delta: number, callback?: (v: number) => void): void {
        this.GetPlayerMMRAsync(steamID, (current) => {
            const updated = current + delta;
            this.UpdatePlayerMMRAsync(steamID, updated, callback);
        });
    }

    // winners/losers are arrays of SteamID strings
    public SubmitMatchResults(winners: string[], losers: string[]): void {
        for (const steamID of winners) {
            this.AdjustPlayerMMRAsync(steamID, 25, (newMMR) => {
                CustomNetTables.SetTableValue("player_stats", steamID, { mmr: newMMR });
            });
        }
        for (const steamID of losers) {
            this.AdjustPlayerMMRAsync(steamID, -25, (newMMR) => {
                CustomNetTables.SetTableValue("player_stats", steamID, { mmr: newMMR });
            });
        }
    }
}
