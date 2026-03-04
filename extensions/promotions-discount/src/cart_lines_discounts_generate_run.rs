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
    tiers: Option<Vec<Tier>>,
}

#[derive(Deserialize)]
struct Tier {
    quantity: i32,
    discount: f64,
}

#[shopify_function]
fn cart_lines_discounts_generate_run(
    input: CartLinesDiscountsGenerateRunInput,
) -> Result<CartLinesDiscountsGenerateRunResult> {

    let mut candidates: Vec<ProductDiscountCandidate> = vec![];

    let offers: Vec<Offer> = match input.shop().metafield() {
        Some(m) => serde_json::from_str(m.value()).unwrap_or_default(),
        None => vec![],
    };

    for offer in offers {

        // ------------------------
        // BUNDLE
        // ------------------------

        if offer.r#type == "bundle" {

            let mut cart_products: Vec<String> = vec![];

            for line in input.cart().lines() {

                if let Merchandise::ProductVariant(variant) = line.merchandise() {

                    cart_products.push(variant.product().id().to_string());
                }
            }

            let bundle_match = offer.products.iter().all(|p| cart_products.contains(p));

            if bundle_match {

                for line in input.cart().lines() {

                    if let Merchandise::ProductVariant(variant) = line.merchandise() {

                        let product_id = variant.product().id().to_string();

                        if offer.products.contains(&product_id) {

                            candidates.push(ProductDiscountCandidate {

                                targets: vec![
                                    ProductDiscountCandidateTarget::CartLine(
                                        CartLineTarget {
                                            id: line.id().to_string(),
                                            quantity: None,
                                        }
                                    )
                                ],

                                value: ProductDiscountCandidateValue::Percentage(
                                    Percentage {
                                        value: Decimal::from(offer.discountValue.unwrap_or(0.0)),
                                    }
                                ),

                                message: Some("Bundle discount".to_string()),
                                associated_discount_code: None,
                            });
                        }
                    }
                }
            }
        }

        // ------------------------
        // VOLUME DISCOUNT
        // ------------------------

        if offer.r#type == "volume_discount" {

            for line in input.cart().lines() {

                if let Merchandise::ProductVariant(variant) = line.merchandise() {

                    let product_id = variant.product().id().to_string();

                    if offer.products.contains(&product_id) {

                        candidates.push(ProductDiscountCandidate {

                            targets: vec![
                                ProductDiscountCandidateTarget::CartLine(
                                    CartLineTarget {
                                        id: line.id().to_string(),
                                        quantity: None,
                                    }
                                )
                            ],

                            value: ProductDiscountCandidateValue::Percentage(
                                Percentage {
                                    value: Decimal::from(offer.discountValue.unwrap_or(0.0)),
                                }
                            ),

                            message: Some("Volume discount".to_string()),
                            associated_discount_code: None,
                        });
                    }
                }
            }
        }

        // ------------------------
        // QUANTITY BREAK
        // ------------------------

        if offer.r#type == "quantity_break" {

            if let Some(tiers) = offer.tiers {

                for line in input.cart().lines() {

                    if let Merchandise::ProductVariant(variant) = line.merchandise() {

                        let product_id = variant.product().id().to_string();

                        if offer.products.contains(&product_id) {

                            let qty = line.quantity();

                            let mut best_discount = 0.0;

                            for tier in tiers.iter() {

                                if *qty >= tier.quantity {

                                    best_discount = tier.discount;
                                }
                            }

                            if best_discount > 0.0 {

                                candidates.push(ProductDiscountCandidate {

                                    targets: vec![
                                        ProductDiscountCandidateTarget::CartLine(
                                            CartLineTarget {
                                                id: line.id().to_string(),
                                                quantity: None,
                                            }
                                        )
                                    ],

                                    value: ProductDiscountCandidateValue::Percentage(
                                        Percentage {
                                            value: Decimal::from(best_discount),
                                        }
                                    ),

                                    message: Some("Quantity discount".to_string()),
                                    associated_discount_code: None,
                                });
                            }
                        }
                    }
                }
            }
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