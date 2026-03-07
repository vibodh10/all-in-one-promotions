use shopify_function::prelude::*;
use serde::Deserialize;
use shopify_function::scalars::Decimal;

use crate::schema::cart_lines_discounts_generate_run::{
    CartLinesDiscountsGenerateRunInput,
};

use crate::schema::{
    CartLinesDiscountsGenerateRunResult,
    ProductDiscountCandidate,
    ProductDiscountCandidateTarget,
    ProductDiscountCandidateValue,
    ProductDiscountSelectionStrategy,
    ProductDiscountsAddOperation,
    CartLineTarget,
    CartOperation,
    Percentage,
};

use crate::schema::cart_lines_discounts_generate_run::
cart_lines_discounts_generate_run_input::cart::lines::Merchandise;

use shopify_function::Result;

#[derive(Deserialize)]
struct Offer {
    r#type: String,
    products: Vec<String>,
    discountValue: Option<f64>,
    minQuantity: Option<i32>,
    tiers: Option<Vec<Tier>>,
}

#[derive(Deserialize)]
struct Tier {
    quantity: i32,
    discount: f64,
}

struct CartItem {
    line_id: String,
    product_id: String,
    quantity: i32,
}

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: CartLinesDiscountsGenerateRunInput,
) -> Result<CartLinesDiscountsGenerateRunResult> {

    let offers: Vec<Offer> = match input.discount().metafield() {
        Some(m) => serde_json::from_str(m.value()).unwrap_or_default(),
        None => vec![],
    };

    // --------------------------------
    // Scan cart once
    // --------------------------------

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

    // --------------------------------
    // Process each offer
    // --------------------------------

    for offer in offers {

        match offer.r#type.as_str() {

            "bundle" => apply_bundle(&offer, &cart_items, &mut candidates),

            "volume_discount" => apply_volume(&offer, &cart_items, &mut candidates),

            "quantity_break" => apply_quantity_break(&offer, &cart_items, &mut candidates),

            _ => {}
        }
    }

    Ok(CartLinesDiscountsGenerateRunResult {
        operations: vec![
            CartOperation::ProductDiscountsAdd(
                ProductDiscountsAddOperation {
                    candidates,
                    selection_strategy: ProductDiscountSelectionStrategy::First,
                }
            )
        ]
    })
}

fn apply_bundle(
    offer: &Offer,
    cart: &Vec<CartItem>,
    candidates: &mut Vec<ProductDiscountCandidate>,
) {

    let mut qty = 0;

    for item in cart {

        if offer.products.contains(&item.product_id) {
            qty += item.quantity;
        }
    }

    if qty < offer.minQuantity.unwrap_or(2) {
        return;
    }

    if let Some(item) = cart.iter().find(|i| offer.products.contains(&i.product_id)) {
        candidates.push(create_candidate(
            &item.line_id,
            offer.discountValue.unwrap_or(0.0),
            "Bundle discount",
        ));
    }
}

fn apply_volume(
    offer: &Offer,
    cart: &Vec<CartItem>,
    candidates: &mut Vec<ProductDiscountCandidate>,
) {

    let tiers = match &offer.tiers {
        Some(t) => t,
        None => return,
    };

    for item in cart {

        if !offer.products.contains(&item.product_id) {
            continue;
        }

        let mut best = 0.0;

        for tier in tiers {
            if item.quantity >= tier.quantity && tier.discount > best {
                best = tier.discount;
            }
        }

        if best > 0.0 {

            candidates.push(create_candidate(
                &item.line_id,
                best,
                "Volume discount",
            ));
        }
    }
}

fn apply_quantity_break(
    offer: &Offer,
    cart: &Vec<CartItem>,
    candidates: &mut Vec<ProductDiscountCandidate>,
) {

    let tiers = match &offer.tiers {
        Some(t) => t,
        None => return,
    };

    for item in cart {

        if !offer.products.contains(&item.product_id) {
            continue;
        }

        let mut best = 0.0;

        for tier in tiers {

            if item.quantity >= tier.quantity {
                best = tier.discount;
            }
        }

        if best > 0.0 {

            candidates.push(create_candidate(
                &item.line_id,
                best,
                "Quantity discount",
            ));
        }
    }
}

fn create_candidate(
    line_id: &str,
    discount: f64,
    message: &str,
) -> ProductDiscountCandidate {

    ProductDiscountCandidate {

        targets: vec![
            ProductDiscountCandidateTarget::CartLine(
                CartLineTarget {
                    id: line_id.to_string(),
                    quantity: None,
                }
            )
        ],

        value: ProductDiscountCandidateValue::Percentage(
            Percentage {
                value: Decimal::from(discount / 100.0),
            }
        ),

        message: Some(message.to_string()),
        associated_discount_code: None,
    }
}