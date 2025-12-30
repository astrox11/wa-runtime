export default {
  VERSION: "1.0.0",
  BOT_NAME: process.env.BOT_NAME || "Whatsaly",
  PHONE_NUMBER: process.env.PHONE_NUMBER || "",
  API_PORT: parseInt(process.env.API_PORT || "3000", 10),
  API_HOST: process.env.API_HOST || "0.0.0.0",
  DEBUG: process.env.DEBUG === "true" || false,
};
