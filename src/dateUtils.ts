/**
 * Date formatting and the IST market calendar, shared by the desktop
 * (Tauri/Next.js) and mobile (React Native) JoyTrader clients.
 *
 * Every helper here is deliberately UTC-based or explicitly IST-based. A
 * trading app must never render "today" in device-local time - a phone in
 * New York would otherwise show a different trading day than the exchange.
 */

/**
 * Formats a timestamp into "dd-MMM-yy" (e.g. 01-Jan-25), or "HH:mm dd-MMM-yy"
 * when `includeTime` is set.
 *
 * Uses UTC getters, so the output does not shift with the device timezone.
 *
 * @param timestamp - Unix timestamp in seconds or milliseconds, a YYYYMMDD
 *                    number, or a Date-parseable string.
 * @returns Formatted date string, or the original value if unparseable.
 */
export const formatDate = (timestamp: any, includeTime: boolean = false): string => {
    if (!timestamp) return "-";

    let date: Date;

    // If it's a number (timestamp)
    if (typeof timestamp === "number" || (typeof timestamp === "string" && !isNaN(Number(timestamp)))) {
        let ts = Number(timestamp);

        // Check if it's YYYYMMDD format (e.g. 20240518)
        if (ts > 19000000 && ts < 21000000) {
            const dateStr = String(ts);
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1; // 0-indexed
            const day = parseInt(dateStr.substring(6, 8));
            date = new Date(Date.UTC(year, month, day));
        } else {
            // Determine if seconds or milliseconds.
            // 10 digits usually means seconds (valid until year 2286)
            // 13 digits means milliseconds
            if (ts < 10000000000) {
                ts *= 1000;
            }
            date = new Date(ts);
        }
    } else {
        // Try parsing as string
        date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) {
        return String(timestamp);
    }

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (includeTime) {
        // Construct HH:mm dd-MMM-yy
        const year = String(date.getUTCFullYear()).slice(-2);
        const month = months[date.getUTCMonth()];
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');

        return `${hours}:${minutes} ${day}-${month}-${year}`;
    }

    // Default Date Only: dd-MMM-yy
    const year = String(date.getUTCFullYear()).slice(-2);
    const month = months[date.getUTCMonth()];
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${day}-${month}-${year}`;
};

// NSE trading holidays (YYYY-MM-DD in IST). Update annually.
const NSE_HOLIDAYS = new Set([
    // 2025
    "2025-01-26", // Republic Day
    "2025-02-19", // Chhatrapati Shivaji Maharaj Jayanti
    "2025-03-14", // Holi
    "2025-04-14", // Dr. Baba Saheb Ambedkar Jayanti
    "2025-04-18", // Good Friday
    "2025-05-01", // Maharashtra Day
    "2025-08-15", // Independence Day
    "2025-10-02", // Gandhi Jayanti / Mahatma Gandhi Jayanti
    "2025-10-02", // Dussehra
    "2025-10-20", // Diwali Laxmi Pujan (Muhurat Trading only)
    "2025-10-21", // Diwali Balipratipada
    "2025-11-05", // Guru Nanak Jayanti
    "2025-12-25", // Christmas
    // 2026
    "2026-01-26", // Republic Day
    "2026-03-20", // Holi (estimated)
    "2026-04-03", // Good Friday (estimated)
    "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
    "2026-05-01", // Maharashtra Day
    "2026-08-15", // Independence Day
    "2026-10-02", // Gandhi Jayanti
    "2026-11-09", // Diwali Laxmi Pujan (estimated — confirm each year)
    "2026-12-25", // Christmas
]);

/** Market open 9:15 AM, close 3:30 PM, both IST. */
export const MARKET_OPEN_MINUTES = 9 * 60 + 15;
export const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns the current time expressed as a Date whose *local* getters read as
 * IST wall-clock.
 *
 * The offset arithmetic cancels the device timezone out:
 *   getTimezoneOffset() === -(local - UTC) in minutes, so adding it moves the
 *   instant to "local wall clock as if UTC". Reading local getters back off
 *   that and adding 5.5h yields IST wall clock in ANY device timezone.
 * Verified equivalent to reading UTC getters off `now + 5.5h`.
 */
const nowAsIst = (): Date => {
    const now = new Date();
    return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + IST_OFFSET_MS);
};

/** YYYY-MM-DD for the current IST calendar day. */
export const istToday = (now: Date = new Date()): string => {
    const ist = nowAsIst();
    const yyyy = ist.getFullYear();
    const mm = String(ist.getMonth() + 1).padStart(2, "0");
    const dd = String(ist.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

/** True when `yyyy-mm-dd` (IST) is a scheduled NSE holiday. */
export const isNseHoliday = (yyyyMmDd: string): boolean => NSE_HOLIDAYS.has(yyyyMmDd);

/**
 * Checks if the Indian stock market is currently open.
 * Market hours: 9:15 AM to 3:30 PM IST, Monday to Friday, excluding NSE
 * holidays.
 */
export const isMarketOpen = (): boolean => {
    const istTime = nowAsIst();

    // Check weekend
    const day = istTime.getDay();
    if (day === 0 || day === 6) return false;

    // Check NSE holiday
    if (NSE_HOLIDAYS.has(istToday())) return false;

    // Check trading hours (9:15 AM – 3:30 PM IST)
    const timeInMinutes = istTime.getHours() * 60 + istTime.getMinutes();

    return timeInMinutes >= MARKET_OPEN_MINUTES && timeInMinutes <= MARKET_CLOSE_MINUTES;
};
