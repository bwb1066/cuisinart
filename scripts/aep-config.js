/**
 * Site-specific configuration for the Adobe Web SDK / AEP integration
 * (websdk.js, personalization.js, demo-panel.js). Centralizing these values
 * here is what makes those three modules portable across sites — copy them
 * verbatim and only this file needs to change.
 *
 * Cuisinart: four kitchen audiences + one logged-in Cuisinart member.
 */
export default {
  // The XDM tenant namespace every custom field goes under. IMPORTANT: an
  // AEP tenant id is assigned ONCE PER IMS ORG, not chosen per site or field
  // group — every site sharing the same Adobe org/datastream must use the
  // exact same value here (visible in AEP's schema editor as the custom
  // field group's top-level object, e.g. `_demosystem4`). Don't invent a
  // per-site string; copy it from the real schema. Leave as a placeholder
  // until one exists — events will simply fail schema validation
  // (harmlessly) until it's corrected.
  tenantId: '_yourtenantid',

  // This replica's identifier, included on every tracked event so a
  // datastream/schema SHARED across multiple sites can still be filtered
  // per site (e.g. in a CJA workspace or a query). Required.
  site: 'cuisinart',

  // Custom DOM event a chat/assistant widget on this site dispatches, with
  // detail: { role: 'assistant', prompt, recommendations }. Set to undefined
  // (or delete the line) if this site has no chat widget.
  chatEventName: 'brand-concierge:message',

  // AJO/Target decision scope label used by the demo panel's persona-switch
  // event. Purely a label for the inspector — doesn't need to exist as a
  // real activity.
  decisionScope: 'homepage-product-rail',

  // Audience segments this site cares about. `match` classifies free text
  // (a chat turn, a product name, page content — whatever a signal source
  // passes to `classify()`) into a segment; the demo panel also uses
  // `key`/`label` to build its persona-switcher buttons. Leave as an empty
  // array if this site has no audience/personalization concept yet — the
  // demo panel will just show an "Anonymous" toggle with no personas.
  audiences: [
    {
      // Lives for the morning cup: drip, grind & brew, espresso, burr mills.
      key: 'coffee_lover',
      label: 'Coffee & Espresso Lover',
      match: /coffee|espresso|latte|cappuccino|brew|grind|burr|bean|carafe|k-cup|pod|cold brew|frother|tea|kettle/i,
    },
    {
      // Bakes from scratch: stand/hand mixers, food processors, bakeware.
      key: 'home_baker',
      label: 'Home Baker',
      match: /bak(e|ing)|mixer|dough|knead|whisk|batter|cake|cookie|bread|pastry|muffin|sheet pan|loaf|food processor|chopper|ice cream|waffle/i,
    },
    {
      // Fast weeknight meals: air fryers, toaster ovens, Griddlers, slow cookers, blenders.
      key: 'quick_cook',
      label: 'Quick & Healthy Cook',
      match: /air fr(y|ier|yer)|toaster oven|griddler|grill|panini|slow cook|pressure|multicook|rice|steam|blend|smoothie|juic|quick|weeknight|healthy/i,
    },
    {
      // Cooks like a pro: cookware sets, skillets, knives, cutting boards.
      key: 'serious_chef',
      label: 'Serious Home Chef',
      match: /cookware|skillet|saut[eé]|sauce ?pan|stock ?pot|dutch oven|stainless|tri-ply|nonstick|cast iron|knife|knives|cutlery|santoku|chef|sharpen|cutting board/i,
    },
  ],

  // Optional "log in as" demo identities, for sites with a contract-account
  // / commerce concept (the demo panel calls window.brandCommerce?.useBuyer()
  // when one is toggled, and fires an identity.authenticatedState event).
  // Each entry: { id, label, note?, extra? } — `id` is whatever your backend
  // matches on (an email, a CRM id), `note` is a one-line subtitle shown in
  // the demo panel, `extra` is merged into the identity event's `_demo`
  // payload. Leave as an empty array to hide the demo panel's Identity section.
  // One signed-in shopper: a Cuisinart member. `id` is the email the
  // commerce_buyers row is keyed on (site_key + email); its price_book holds
  // member pricing, resolved server-side when the demo panel logs them in.
  demoPersonas: [
    {
      id: 'sam.patel@example.com',
      label: 'Sam Patel · Cuisinart Member',
      note: 'Member pricing (15% off) · coffee-lover profile',
      extra: { accountType: 'loyalty', tier: 'member', profile: 'coffee_lover' },
    },
  ],

  // --- Advanced, optional — only needed if aep-config's defaults don't fit ---

  // Window global name personalization.js/demo-panel.js set to the leading
  // audience, for on-page block JS to read before Adobe is live. Defaults to
  // `aepAudience`; override only if another module on this site already
  // reads a differently-named global (e.g. a shared p13n.js state helper).
  // audienceGlobal: 'aepAudience',

  // sessionStorage key overrides, only needed if another module on this site
  // already owns these names (e.g. a shared p13n.js) and must stay in sync.
  // Defaults shown:
  // storageKeys: {
  //   override: 'aep_audience_override',
  //   buyer: 'aep_demo_buyer',
  //   tally: 'aep_audience_signal',
  //   demoFlag: 'aep_demo',
  // },

  // Override which XDM eventType a signal source maps to (default: 'content'
  // → 'web.webpagedetails.pageViews', everything else → 'experience.chat.
  // interaction'). Only needed if a custom signal source (see
  // wireExtraSignals below) should map to something else, e.g. a commerce
  // add-to-cart signal:
  // eventTypeForSource: (source) => (source === 'commerce'
  //   ? 'commerce.productListAdds'
  //   : source === 'content' ? 'web.webpagedetails.pageViews' : 'experience.chat.interaction'),

  // Wire up additional signal sources beyond chat + page views — e.g. a
  // commerce store's cart/quote changes. Called once from initPersonalization
  // with `{ classify, recordSignal, track }` (all exported by
  // personalization.js). `recordSignal` is for the audience-tally bookkeeping
  // (cheap, always available); `track` is the generic, low-level sender —
  // reach for it directly whenever a new kind of event needs AEP's standard
  // XDM shape (e.g. Commerce's `productListItems`) rather than the generic
  // tenant `signal` object. This is also the pattern for tracking any FUTURE
  // event type nobody has thought of yet: call `track('some.eventType', {...})`
  // from wherever that interaction happens — no changes to personalization.js
  // ever required.
  //
  // Example, watching a commerce store module for new cart lines and sending
  // both a standards-based commerce event AND the generic audience signal.
  // CAVEAT that cost real debugging time: if the store's `subscribe()` does
  // NOT fire synchronously with the current state (check — many don't), seed
  // `counted` from a synchronous getter (e.g. `store.getQuote()`) up front,
  // not from "the first emission received". Otherwise the very first real
  // add-to-cart click on a fresh page load looks identical to a restored
  // cart and gets silently swallowed — exactly what happened here.
  async wireExtraSignals({ classify, recordSignal, track }) {
    const { default: store } = await import('./commerce.js');
    const counted = new Set((store.getQuote()?.lines || []).map((l) => String(l.sku)));
    store.subscribe((quote) => {
      (quote?.lines || []).forEach((line) => {
        const sku = String(line.sku);
        if (counted.has(sku)) return;
        counted.add(sku);
        track('commerce.productListAdds', {
          standard: {
            commerce: { productListAdds: { value: 1 } },
            productListItems: [{
              SKU: sku,
              name: line.name,
              quantity: line.qty,
              priceTotal: { value: line.qty * line.unit_price },
            }],
          },
        });
        recordSignal(classify(line.name), 'commerce', { sku });
      });
    });
  },
};
