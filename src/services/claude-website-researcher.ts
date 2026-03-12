/**
 * Claude Website Researcher
 *
 * Scrapes company websites to find executive information (names, emails, phones)
 * Tier 1 (FREE): Firecrawl → Claude AI extraction (intelligent, understands Dutch)
 * Tier 2 (fallback): Basic Cheerio/regex scraping
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';

export interface ExecutiveInfo {
  firstName: string;
  lastName: string;
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  source: 'website' | 'contact_page' | 'about_page' | 'team_page';
  confidence: number; // 0-1
}

export interface WebsiteResearchResult {
  executives: ExecutiveInfo[];
  emailPatterns: string[]; // e.g., ["firstname.lastname@domain.com"]
  companyEmails: string[]; // Generic emails like info@, contact@
  phones: string[];
  success: boolean;
  method: 'basic_scraping' | 'claude_api' | 'hybrid';
  durationMs: number;
  error?: string;
}

/**
 * Claude Website Researcher
 * Finds executive information from company websites
 */
export class ClaudeWebsiteResearcher {
  private timeout = 15000;
  private userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  constructor(
    private claudeApiKey?: string,
    private firecrawlApiKey?: string
  ) {}

  /**
   * Research a company website for executive information
   */
  async researchWebsite(
    websiteUrl: string,
    companyName: string,
    domain: string
  ): Promise<WebsiteResearchResult> {
    const startTime = Date.now();

    try {
      const normalizedUrl = this.normalizeUrl(websiteUrl);

      // Try Firecrawl + Claude first (intelligent extraction)
      if (this.claudeApiKey && this.firecrawlApiKey) {
        console.log('🤖 Using Firecrawl + Claude for intelligent extraction...');
        try {
          return await this.researchWithFirecrawlAndClaude(normalizedUrl, companyName, domain);
        } catch (err: any) {
          console.warn(`⚠️  Firecrawl+Claude failed (${err.message}), falling back to basic scraping`);
        }
      }

      // Fallback to basic web scraping
      console.log('🔍 Using basic web scraping...');
      return await this.researchWithBasicScraping(normalizedUrl, companyName, domain);
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error('Website research error:', error.message);

      return {
        executives: [],
        emailPatterns: [],
        companyEmails: [],
        phones: [],
        success: false,
        method: 'basic_scraping',
        durationMs,
        error: error.message,
      };
    }
  }

  /**
   * Tier 1: Firecrawl → Claude AI extraction
   * Uses Firecrawl to get clean markdown, then Claude to intelligently extract contacts
   */
  private async researchWithFirecrawlAndClaude(
    websiteUrl: string,
    companyName: string,
    domain: string
  ): Promise<WebsiteResearchResult> {
    const startTime = Date.now();

    // Step A: Firecrawl scrape → clean markdown
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!firecrawlResponse.ok) {
      throw new Error(`Firecrawl error: ${firecrawlResponse.status} ${firecrawlResponse.statusText}`);
    }

    const firecrawlData = await firecrawlResponse.json();

    if (!firecrawlData.success || !firecrawlData.data?.markdown) {
      throw new Error('Firecrawl returned no markdown content');
    }

    const markdown = firecrawlData.data.markdown as string;
    console.log(`   Firecrawl: ${markdown.length} chars of markdown`);

    // Step B: Claude extraction
    const prompt = `You are extracting business contact data from a company website. Return ONLY valid JSON, no explanation.

Company: ${companyName}
Domain: ${domain}
Website content (markdown):
---
${markdown.slice(0, 6000)}
---

Extract contact information and return this exact JSON structure:
{
  "executives": [
    {
      "firstName": "string",
      "lastName": "string",
      "fullName": "string",
      "title": "string or null",
      "email": "string or null",
      "phone": "string or null",
      "linkedinUrl": "string or null",
      "confidence": 0.0-1.0
    }
  ],
  "companyEmails": ["info@example.com"],
  "phones": ["+31612345678"]
}

Rules:
- Focus on owners, directors, founders, managers (Eigenaar, Directeur, Tandarts, CEO, etc.)
- Include Dutch titles: Eigenaar, Directeur, Algemeen Directeur, Bedrijfsleider, Tandarts
- Only include real person names (not company names or generic text)
- Set confidence: 0.9 if email found, 0.8 if title found, 0.7 if name only
- companyEmails: generic emails like info@, contact@, support@
- If nothing found, return empty arrays
- Return ONLY the JSON object, nothing else`;

    const anthropic = new Anthropic({ apiKey: this.claudeApiKey });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    console.log(`   Claude response: ${responseText.length} chars`);

    // Parse JSON response
    let parsed: {
      executives?: Array<{
        firstName: string;
        lastName: string;
        fullName: string;
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        linkedinUrl?: string | null;
        confidence?: number;
      }>;
      companyEmails?: string[];
      phones?: string[];
    };

    try {
      // Strip potential markdown code fences
      const jsonText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(`Claude returned invalid JSON: ${responseText.slice(0, 200)}`);
    }

    const executives: ExecutiveInfo[] = (parsed.executives || [])
      .filter((e) => e.firstName && e.lastName)
      .map((e) => ({
        firstName: e.firstName,
        lastName: e.lastName,
        fullName: e.fullName || `${e.firstName} ${e.lastName}`,
        title: e.title || undefined,
        email: e.email || undefined,
        phone: e.phone || undefined,
        linkedinUrl: e.linkedinUrl || undefined,
        source: 'website' as const,
        confidence: e.confidence ?? 0.8,
      }));

    const companyEmails = parsed.companyEmails || [];
    const phones = parsed.phones || [];

    // Detect email patterns from executive emails
    const executiveEmails = executives.filter((e) => e.email).map((e) => e.email as string);
    const emailPatterns = this.detectEmailPatterns(executiveEmails);

    const durationMs = Date.now() - startTime;

    return {
      executives: executives.slice(0, 3),
      emailPatterns,
      companyEmails,
      phones,
      success: executives.length > 0 || companyEmails.length > 0,
      method: 'claude_api',
      durationMs,
    };
  }

  /**
   * Tier 2: Basic web scraping approach (FREE fallback)
   * Scrapes common pages and uses regex to find executives
   */
  private async researchWithBasicScraping(
    websiteUrl: string,
    companyName: string,
    domain: string
  ): Promise<WebsiteResearchResult> {
    const startTime = Date.now();
    const executives: ExecutiveInfo[] = [];
    const emailPatterns: string[] = [];
    const companyEmails: string[] = [];
    const phones: string[] = [];

    const pagesToCheck = [
      websiteUrl,
      `${websiteUrl}/about`,
      `${websiteUrl}/over-ons`,
      `${websiteUrl}/team`,
      `${websiteUrl}/contact`,
      `${websiteUrl}/about-us`,
      `${websiteUrl}/leadership`,
      `${websiteUrl}/management`,
    ];

    for (const pageUrl of pagesToCheck) {
      try {
        const html = await this.fetchPage(pageUrl);
        if (!html) continue;

        const $ = cheerio.load(html);
        const textContent = $('body').text();

        const foundEmails = this.extractEmails(textContent, domain);
        foundEmails.forEach((email) => {
          if (this.isGenericEmail(email)) {
            if (!companyEmails.includes(email)) companyEmails.push(email);
          } else {
            if (!emailPatterns.includes(email)) emailPatterns.push(email);
          }
        });

        const foundPhones = this.extractPhones(textContent);
        foundPhones.forEach((phone) => {
          if (!phones.includes(phone)) phones.push(phone);
        });

        const foundExecutives = this.extractExecutives(html, domain, pageUrl);
        foundExecutives.forEach((exec) => {
          const exists = executives.some(
            (e) =>
              e.fullName.toLowerCase() === exec.fullName.toLowerCase() ||
              (e.email && exec.email && e.email === exec.email)
          );
          if (!exists) executives.push(exec);
        });
      } catch {
        continue;
      }
    }

    const detectedPatterns = this.detectEmailPatterns(emailPatterns);
    const durationMs = Date.now() - startTime;

    return {
      executives: executives.slice(0, 3),
      emailPatterns: detectedPatterns,
      companyEmails,
      phones,
      success: executives.length > 0 || emailPatterns.length > 0,
      method: 'basic_scraping',
      durationMs,
    };
  }

  private async fetchPage(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });
      return response.data;
    } catch {
      return null;
    }
  }

  private extractEmails(text: string, domain: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return matches
      .filter((email) => email.toLowerCase().includes(domain.toLowerCase()))
      .map((email) => email.toLowerCase());
  }

  private extractPhones(text: string): string[] {
    const phoneRegex =
      /(\+31|0031|0)\s?([1-9][0-9])\s?([0-9]{3})\s?([0-9]{2})\s?([0-9]{2})|(\+31|0031|0)([1-9][0-9]{8})/g;
    const matches = text.match(phoneRegex) || [];
    return [...new Set(matches)].slice(0, 5);
  }

  private extractExecutives(html: string, domain: string, source: string): ExecutiveInfo[] {
    const $ = cheerio.load(html);
    const executives: ExecutiveInfo[] = [];

    const titles = [
      'CEO', 'Chief Executive Officer', 'Owner', 'Co-Owner', 'Founder', 'Co-Founder',
      'Managing Director', 'Director', 'President',
      'Eigenaar', 'Mede-eigenaar', 'Directeur', 'Algemeen Directeur', 'Bedrijfsleider',
      'Tandarts', 'Dr.',
    ];

    const bodyText = $('body').text();
    titles.forEach((title) => {
      const titleRegex = new RegExp(`(${title})[:\\s-]+([A-Z][a-z]+ [A-Z][a-z]+)`, 'gi');
      const matches = bodyText.matchAll(titleRegex);
      for (const match of matches) {
        const fullName = match[2].trim();
        const [firstName, ...lastNameParts] = fullName.split(' ');
        const lastName = lastNameParts.join(' ');
        if (firstName && lastName) {
          executives.push({
            firstName,
            lastName,
            fullName,
            title: match[1],
            source: this.getPageType(source),
            confidence: 0.7,
          });
        }
      }
    });

    $('.team-member, .team-card, .member, .profile, .bio').each((i, elem) => {
      const $elem = $(elem);
      const name = $elem.find('h1, h2, h3, h4, .name, .member-name').first().text().trim();
      const title = $elem.find('.title, .position, .role, .job-title').first().text().trim();
      const email = $elem.find('a[href^="mailto:"]').attr('href')?.replace('mailto:', '');
      const phone = $elem.find('a[href^="tel:"]').attr('href')?.replace('tel:', '');

      if (name && this.looksLikeName(name)) {
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ');
        if (firstName && lastName) {
          executives.push({
            firstName,
            lastName,
            fullName: name,
            title: title || undefined,
            email: email || undefined,
            phone: phone || undefined,
            source: this.getPageType(source),
            confidence: 0.8,
          });
        }
      }
    });

    return executives;
  }

  private detectEmailPatterns(emails: string[]): string[] {
    const patterns: Set<string> = new Set();
    emails.forEach((email) => {
      const [local] = email.split('@');
      const parts = local.split('.');
      if (parts.length === 2) {
        patterns.add('firstname.lastname');
      } else if (parts.length === 1 && local.length <= 10) {
        patterns.add('firstnamelastname');
      } else if (local.includes('_')) {
        patterns.add('firstname_lastname');
      }
    });
    return Array.from(patterns);
  }

  private isGenericEmail(email: string): boolean {
    const genericPrefixes = ['info', 'contact', 'sales', 'support', 'hello', 'mail', 'office'];
    const [local] = email.split('@');
    return genericPrefixes.some((prefix) => local.toLowerCase().startsWith(prefix));
  }

  private looksLikeName(text: string): boolean {
    const words = text.trim().split(/\s+/);
    if (words.length < 2 || words.length > 4) return false;
    if (/\d/.test(text)) return false;
    if (words.some((w) => w.length < 2)) return false;
    return words.every((w) => /^[A-Z]/.test(w));
  }

  private getPageType(url: string): ExecutiveInfo['source'] {
    const lower = url.toLowerCase();
    if (lower.includes('team')) return 'team_page';
    if (lower.includes('about') || lower.includes('over-ons')) return 'about_page';
    if (lower.includes('contact')) return 'contact_page';
    return 'website';
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url.replace(/\/$/, '');
  }
}

export default ClaudeWebsiteResearcher;
