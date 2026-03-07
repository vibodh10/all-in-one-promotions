use shopify_function::prelude::*;
use serde::Deserialize;
use shopify_function::scalars::Decimal;
use crate::schema::cart_lines_discounts_generate_run::CartLinesDiscountsGenerateRunInput;
use crate::schema::{
    CartLineTarget,
    CartLinesDiscountsGenerateRunResult,
    CartOperation,
    Percentage,
    ProductDiscountCandidate,
    ProductDiscountCandidateTarget,
    ProductDiscountCandidateValue,
    ProductDiscountSelectionStrategy,
    ProductDiscountsAddOperation,
};

use crate::schema::cart_lines_discounts_generate_run::cart_lines_discounts_generate_run_input::cart::lines::Merchandise;
use shopify_function::Result;

#[derive(Deserialize, Debug)]
struct Offer {
    #[serde(rename = "type")]
    r#type: String,

    #[serde(default)]
    products: Vec<String>,

    #[serde(rename = "discountValue",
    alias = "discount_value")]
    discount_value: Option<f64>,

    #[serde(rename = "bundle_config", alias = "bundleConfig")]
    bundle_config: Option<BundleConfig>,
    #[serde(default)]
    tiers: Option<Vec<Tier>>,
}

#[derive(Deserialize, Debug)]
struct BundleConfig {
    #[serde(rename = "minItems", alias = "min_items")] min_items: Option<i32>, } #[derive(Deserialize, Debug)] struct Tier { quantity: i32, discount: f64, } #[derive(Debug)] struct CartItem { line_id: String, product_id: String, quantity: i32, } #[shopify_function] fn cart_lines_discounts_generate_run( input: CartLinesDiscountsGenerateRunInput, ) -> Result<CartLinesDiscountsGenerateRunResult> { let offers: Vec<Offer> = match input.discount().metafield() { Some(m) => serde_json::from_str(m.value()).unwrap_or_default(), None => vec![], }; let mut cart_items: Vec<CartItem> = vec![]; for line in input.cart().lines() { if let Merchandise::ProductVariant(variant) = line.merchandise() { cart_items.push(CartItem { line_id: line.id().to_string(), product_id: variant.id().to_string(), quantity: *line.quantity(), }); } } let mut candidates: Vec<ProductDiscountCandidate> = vec![]; for offer in &offers { match offer.r#type.as_str() { "volume_discount" => apply_volume(offer, &cart_items, &mut candidates), "quantity_break" => apply_quantity_break(offer, &cart_items, &mut candidates), _ => {} } } if candidates.is_empty() { Ok(CartLinesDiscountsGenerateRunResult { operations: vec![], }) } else { Ok(CartLinesDiscountsGenerateRunResult { operations: vec![CartOperation::ProductDiscountsAdd( ProductDiscountsAddOperation { candidates, selection_strategy: ProductDiscountSelectionStrategy::All, }, )], }) } } fn apply_volume( offer: &Offer, cart_items: &[CartItem], candidates: &mut Vec<ProductDiscountCandidate>, ) { let tiers = match &offer.tiers { Some(t) if !t.is_empty() => t, _ => return, }; for product in &offer.products { for item in cart_items.iter().filter(|item| same_id(&item.product_id, product)) { let mut best = 0.0; for tier in tiers { if item.quantity >= tier.quantity && tier.discount > best { best = tier.discount; } } if best > 0.0 { candidates.push(create_percentage_candidate( &item.line_id, best, "Volume discount", )); } } } } fn apply_quantity_break( offer: &Offer, cart_items: &[CartItem], candidates: &mut Vec<ProductDiscountCandidate>, ) { let tiers = match &offer.tiers { Some(t) if !t.is_empty() => t, _ => return, }; for product in &offer.products { for item in cart_items.iter().filter(|item| same_id(&item.product_id, product)) { let mut best = 0.0; for tier in tiers { if item.quantity >= tier.quantity && tier.discount > best { best = tier.discount; } } if best > 0.0 { candidates.push(create_percentage_candidate( &item.line_id, best, "Quantity discount", )); } } } } fn create_percentage_candidate( line_id: &str, discount: f64, message: &str, ) -> ProductDiscountCandidate { ProductDiscountCandidate { targets: vec![ProductDiscountCandidateTarget::CartLine(CartLineTarget { id: line_id.to_string(), quantity: None, })], value: ProductDiscountCandidateValue::Percentage(Percentage { value: Decimal::from(discount), }), message: Some(message.to_string()), associated_discount_code: None, } } fn same_id(a: &str, b: &str) -> bool { a == b || extract_numeric_id(a) == extract_numeric_id(b) } fn extract_numeric_id(value: &str) -> &str { value.rsplit('/').next().unwrap_or(value) }