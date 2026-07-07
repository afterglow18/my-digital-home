/**
 * Seed script — creates the "Unlock Forever" product and $4.99 price in Stripe.
 *
 * Idempotent: checks for an existing product before creating a new one.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run seed-products
 */
import { getUncachableStripeClient } from './stripeClient';

async function seed() {
  const stripe = await getUncachableStripeClient();

  console.log('Checking for existing unlock product...');
  const existing = await stripe.products.search({
    query: "metadata['product_key']:'unlock' AND active:'true'",
    limit: 1,
  });

  if (existing.data.length > 0) {
    const product = existing.data[0];
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 1 });
    console.log(`✓ Unlock product already exists: ${product.id}`);
    if (prices.data.length > 0) {
      console.log(`✓ Active price: ${prices.data[0].id}  ($${(prices.data[0].unit_amount! / 100).toFixed(2)} ${prices.data[0].currency.toUpperCase()})`);
    }
    return;
  }

  console.log('Creating "Unlock Forever" product...');
  const product = await stripe.products.create({
    name: 'Unlock Forever',
    description: 'Unlimited wardrobe items and saved outfits. One-time purchase, no subscription.',
    metadata: {
      product_key: 'unlock',
    },
  });
  console.log(`✓ Created product: ${product.name} (${product.id})`);

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 499, // $4.99
    currency: 'usd',
    metadata: { product_key: 'unlock' },
  });
  console.log(`✓ Created price: $4.99 one-time (${price.id})`);

  console.log('\n✅ Done! Stripe will sync this to your database automatically via webhook.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
