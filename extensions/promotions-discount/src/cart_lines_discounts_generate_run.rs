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

/* ================================
   DATA STRUCTURES
================================ */

#[derive(Deserialize, Debug)]
struct Offer {
    #[serde(rename = "type")]
    r#type: String,

    #[serde(default)]
    products: Vec<String>,

    #[serde(default)]
    targeting: Option<Targeting>,

    #[serde(rename = "discountValue", alias = "discount_value")]
    discount_value: Option<f64>,

    #[serde(default)]
    tiers: Option<Vec<Tier>>,
}

#[derive(Deserialize, Debug)]
struct Tier {
    quantity: i32,
    discount: f64,
}

#[derive(Deserialize, Debug)]
struct Targeting {
    mode: Option<String>,
}

#[derive(Debug)]
struct CartItem {
    line_id: String,
    product_id: String,
    quantity: i32,
}

/* ================================
   ENTRY POINT
================================ */

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: CartLinesDiscountsGenerateRunInput,
) -> Result<CartLinesDiscountsGenerateRunResult> {

    let offers: Vec<Offer> = match input.discount().metafield() {
        Some(m) => {
            serde_json::from_str::<Vec<Offer>>(m.value())
                .or_else(|_| serde_json::from_str::<Offer>(m.value()).map(|o| vec![o]))
                .unwrap_or_default()
        }
        None => vec![],
    };

    let mut cart_items: Vec<CartItem> = vec![];

    for line in input.cart().lines() {
        if let Merchandise::ProductVariant(variant) = line.merchandise() {
            cart_items.push(CartItem {
                line_id: line.id().to_string(),
                product_id: variant.product().id().to_string(),
                quantity: *line.quantity(),
            });
        }
    }

    let mut candidates: Vec<ProductDiscountCandidate> = vec![];

    for offer in &offers {
        match offer.r#type.as_str() {
            "volume_discount" => apply_offer(offer, &cart_items, &mut candidates, "Volume discount"),
            "quantity_break" => apply_offer(offer, &cart_items, &mut candidates, "Quantity discount"),
            _ => {}
        }
    }

    if candidates.is_empty() {
        Ok(CartLinesDiscountsGenerateRunResult { operations: vec![] })
    } else {
        Ok(CartLinesDiscountsGenerateRunResult {
            operations: vec![
                CartOperation::ProductDiscountsAdd(ProductDiscountsAddOperation {
                    candidates,
                    selection_strategy: ProductDiscountSelectionStrategy::All,
                })
            ],
        })
    }
}

/* ================================
   CORE LOGIC (SHARED)
================================ */

fn apply_offer(
    offer: &Offer,
    cart_items: &[CartItem],
    candidates: &mut Vec<ProductDiscountCandidate>,
    label: &str,
) {
    let tiers = match &offer.tiers {
        Some(t) if !t.is_empty() => t,
        _ => return,
    };

    let is_all = offer
        .targeting
        .as_ref()
        .and_then(|t| t.mode.as_ref())
        .map(|m| m == "all")
        .unwrap_or(false);

    for item in cart_items {

        // ✅ FILTER
        if !is_all && !offer.products.iter().any(|p| same_id(&item.product_id, p)) {
            continue;
        }

        // ✅ FIND BEST TIER
        let mut best = 0.0;

        for tier in tiers {
            if item.quantity >= tier.quantity && tier.discount > best {
                best = tier.discount;
            }
        }

        // ✅ APPLY
        if best > 0.0 {
            candidates.push(create_percentage_candidate(
                &item.line_id,
                best,
                label,
            ));
        }
    }
}

/* ================================
   HELPERS
================================ */

fn create_percentage_candidate(
    line_id: &str,
    discount: f64,
    message: &str,
) -> ProductDiscountCandidate {
    ProductDiscountCandidate {
        targets: vec![
            ProductDiscountCandidateTarget::CartLine(CartLineTarget {
                id: line_id.to_string(),
                quantity: None,
            })
        ],
        value: ProductDiscountCandidateValue::Percentage(Percentage {
            value: Decimal::from(discount),
        }),
        message: Some(message.to_string()),
        associated_discount_code: None,
    }
}

fn same_id(a: &str, b: &str) -> bool {
    a == b || extract_numeric_id(a) == extract_numeric_id(b)
}

fn extract_numeric_id(value: &str) -> &str {
    value.rsplit('/').next().unwrap_or(value)
}