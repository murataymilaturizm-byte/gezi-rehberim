import { Helmet } from "react-helmet-async";

interface HreflangLink {
  rel: string;
  hreflang: string;
  href: string;
}

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  schema?: object;
  type?: "website" | "article";
  extraLinks?: HreflangLink[];
}

const SITE_NAME = "Turzz AI";
const DEFAULT_TITLE = "Turzz AI - Seyahat Acenteleri için WhatsApp Chatbot";
const DEFAULT_DESCRIPTION =
  "Turzz AI ile WhatsApp üzerinden 7/24 otomatik tur satışı yapın. 7 dil desteği, AI destekli rezervasyon asistanı, tur operatörleri için akıllı chatbot.";
const DEFAULT_KEYWORDS =
  "whatsapp chatbot seyahat acentesi, ai tur rezervasyonu, tur operatörü yazılımı, otomatik tur satışı, whatsapp bot turizm";
const DEFAULT_OG_IMAGE = "https://turzzai.com/og-default.svg";
const SITE_URL = "https://turzzai.com";

export const SEOHead = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  ogImage = DEFAULT_OG_IMAGE,
  canonical,
  schema,
  type = "website",
  extraLinks,
}: SEOHeadProps) => {
  const fullTitle = title === DEFAULT_TITLE ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* hreflang alternate links */}
      {extraLinks?.map((link, i) => (
        <link key={i} rel={link.rel} hrefLang={link.hreflang} href={link.href} />
      ))}

      {/* JSON-LD Schema */}
      {schema && (
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      )}
    </Helmet>
  );
};
