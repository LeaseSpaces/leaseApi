import request from "supertest";
import { app } from "../app";

const token = "Bearer mock_jwt_token";

describe("Settings API", () => {
  it("POST /api/settings/app - should update app settings", async () => {
    const res = await request(app)
      .post("/api/settings/app")
      .set('Authorization', token)
      .send({
        appName: "Test App",
        logo: "test-logo.png",
        favicon: "test-favicon.png",
        googleMapsApiKey: "test-key",
        allowedRegions: ["Region1"],
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
        supportEmail: "support@example.com",
        supportPhone: "1234567890",
        termsAndConditions: "Test Terms",
        privacyPolicy: "Test Privacy",
        aboutPage: "About",
        disclaimer: "Disclaimer",
        emailFooterText: "Footer",
        emailHeaderText: "Header",
        websiteUrl: "https://example.com",
        companyAddress: "Test Address",
        companyPhone: "1234567890"
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("appName");
  });

  it("GET /api/settings/app - should return app settings", async () => {
    const res = await request(app)
      .get("/api/settings/app")
      .set("Authorization", token);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("appName");
    expect(res.body).toHaveProperty("logo");
  });
});
