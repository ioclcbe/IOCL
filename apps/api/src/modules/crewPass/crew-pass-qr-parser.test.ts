import { describe, expect, it } from "vitest";
import { looksLikeCrewPassQr, parseCrewPassQr } from "./crew-pass-qr-parser.js";

const sample = `Crew Id : IOC11965186D0010\nName : RAGUPRABAHAR C \nCrew Type : Driver \npass valid Upto : 03/08/2025 \nTT No : TN74AZ8730 \nDL No : Tn7420210005690 \nDL Expiry Date : 02/07/2026`;

describe("crew pass QR parser", () => {
  it("parses the exact supplied legacy QR", () => {
    const value = parseCrewPassQr(sample);
    expect(value.crewId).toBe("IOC11965186D0010");
    expect(value.driverName).toBe("RAGUPRABAHAR C");
    expect(value.ttNumberOnPass).toBe("TN74AZ8730");
    expect(value.drivingLicenseNumber).toBe("Tn7420210005690");
    expect(value.passValidUntil).toBe("03-Aug-2025");
  });
  it("supports CRLF, case and label aliases with a stable canonical hash", () => {
    const alternate = sample.replaceAll("\n", "\r\n").replace("Crew Id", "crew ID").replace("pass valid Upto", "Pass Valid Up To").replace("DL No", "Driving License Number").replace("DL Expiry Date", "Driving License Expiry Date");
    expect(parseCrewPassQr(alternate).crewId).toBe("IOC11965186D0010");
    expect(parseCrewPassQr(alternate).payloadHash).toBe(parseCrewPassQr(sample).payloadHash);
  });
  it("detects raw crew pass payloads", () => expect(looksLikeCrewPassQr(sample)).toBe(true));
  it("rejects duplicate required labels", () => expect(() => parseCrewPassQr(`${sample}\nName: OTHER DRIVER`)).toThrow(/Duplicate required field/));
  it("rejects a missing field", () => expect(() => parseCrewPassQr(sample.replace(/^TT No.*$/m, ""))).toThrow(/Missing required field/));
  it("rejects impossible dates", () => expect(() => parseCrewPassQr(sample.replace("03/08/2025", "31/02/2025"))).toThrow(/valid calendar date/));
  it("rejects unsupported crew types", () => expect(() => parseCrewPassQr(sample.replace("Crew Type : Driver", "Crew Type : Pilot"))).toThrow(/unsupported crew type/));
  it("rejects invalid identifiers", () => expect(() => parseCrewPassQr(sample.replace("TN74AZ8730", "@@"))).toThrow(/invalid TT number/));
  it("rejects control characters and oversized data", () => {
    expect(() => parseCrewPassQr(`${sample}\u0000`)).toThrow(/control characters/);
    expect(() => parseCrewPassQr(sample + "X".repeat(2_100))).toThrow(/larger than/);
  });
});
