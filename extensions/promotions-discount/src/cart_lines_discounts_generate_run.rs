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

use std::collections::{HashMap, HashSet};

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

    //--------------------------------
    // Scan cart once
    //--------------------------------

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

    //--------------------------------
    // Build product lookup map
    //--------------------------------

    let mut product_map: HashMap<String, Vec<&CartItem>> = HashMap::new();

    for item in &cart_items {
        product_map
            .entry(item.product_id.clone())
            .or_default()
            .push(item);
    }

    let mut candidates: Vec<ProductDiscountCandidate> = vec![];

    //--------------------------------
    // Process offers
    //--------------------------------

    for offer in offers {

        match offer.r#type.as_str() {

            "bundle" => apply_bundle(&offer, &product_map, &mut candidates),

            "volume_discount" => apply_volume(&offer, &product_map, &mut candidates),

            "quantity_break" => apply_quantity_break(&offer, &product_map, &mut candidates),

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
    product_map: &HashMap<String, Vec<&CartItem>>,
    candidates: &mut Vec<ProductDiscountCandidate>,
) {

    let mut unique_products: HashSet<String> = HashSet::new();

    for product in &offer.products {
        if product_map.contains_key(product) {
            unique_products.insert(product.clone());
        }
    }

    if unique_products.len() < offer.minQuantity.unwrap_or(2) as usize {
        return;
    }

    // apply bundle discount to first matching item
    for product in &offer.products {
        if let Some(items) = product_map.get(product) {

            let item = items[0];

            candidates.push(create_candidate(
                &item.line_id,
                offer.discountValue.unwrap_or(0.0),
                "Bundle discount",
            ));

            break;
        }
    }
}

fn apply_volume(
    offer: &Offer,
    product_map: &HashMap<String, Vec<&CartItem>>,
    candidates: &mut Vec<ProductDiscountCandidate>,
) {

    let tiers = match &offer.tiers {
        Some(t) => t,
        None => return,
    };

    for product in &offer.products {

        if let Some(items) = product_map.get(product) {

            for item in items {

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
    }
}

fn apply_quantity_break(
    offer: &Offer,
    product_map: &HashMap<String, Vec<&CartItem>>,
    candidates: &mut Vec<ProductDiscountCandidate>,
) {

    let tiers = match &offer.tiers {
        Some(t) => t,
        None => return,
    };

    for product in &offer.products {

        if let Some(items) = product_map.get(product) {

            for item in items {

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
                        "Quantity discount",
                    ));
                }
            }
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
                value: Decimal::from(discount),
            }
        ),

        message: Some(message.to_string()),
        associated_discount_code: None,
    }
}