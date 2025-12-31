import type { NewsletterMetadata } from "baileys";

export class Newsletter {
  newsletterJid: string;
  metadata: NewsletterMetadata;

  constructor(newsletterJid: string, metadata: NewsletterMetadata) {
    this.newsletterJid = newsletterJid;
    this.metadata = metadata;
  }
}
