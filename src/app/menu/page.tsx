"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./OrderPage.module.css";
import Navbar from "@/components/layout/nav/Nav";
import { useCart, type Product } from "@/app/context/CartContext";
import ProductOptionsModal from "@/components/ProductOptionsModal/ProductOptionsModal";
import CheckoutModal from "@/components/checkout/CheckoutModal";
interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  products: Product[];
}

/* ── Product Card ── */
function ProductCard({
  product,
  onAdd,
  index,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  index: number;
}) {
  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.is_available) return;
    onAdd(product);
  };

  return (
    <div
      className={`${styles.card} ${!product.is_available ? styles.cardUnavailable : ""}`}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className={styles.cardImgWrap}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className={styles.cardImg} />
        ) : (
          <div className={styles.cardImgFallback} aria-hidden="true" />
        )}
        {product.is_featured && (
          <span className={styles.featuredPill}>Popular</span>
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <span className={styles.cardName}>{product.name}</span>
        </div>
        {product.description && (
          <p className={styles.cardDesc}>{product.description}</p>
        )}
        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}>€{product.price.toFixed(2)}</span>
          {product.is_available ? (
            <button
              className={styles.addBtn}
              onClick={handleAdd}
              aria-label={`Add ${product.name} to cart`}
            >
              +
            </button>
          ) : (
            <span className={styles.unavailableTag}>Unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Category Hero ── */
function CategoryHero({ category }: { category: Category }) {
  if (category.image_url) {
    return (
      <div className={styles.catHero}>
        <img
          src={category.image_url}
          alt={category.name}
          className={styles.catHeroImg}
        />
        <div className={styles.catHeroOverlay} />
        <div className={styles.catHeroContent}>
          <h2 className={styles.catHeroName}>{category.name}</h2>
          {category.description && (
            <p className={styles.catHeroDesc}>{category.description}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.catHeroPlain}>
      <h2 className={styles.catHeroPlainName}>{category.name}</h2>
      {category.description && (
        <p className={styles.catHeroPlainDesc}>{category.description}</p>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function OrderPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
const [navScrolled, setNavScrolled] = useState(false);
  const { add, totalItems, totalPrice, setCartOpen } = useCart();
  const navRef = useRef<HTMLDivElement>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
// Add this in OrderPage, near your other useEffects
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("sumup_checkout_id")) {
    setCheckoutOpen(true);
  }
}, []);



  useEffect(() => {
    fetch(`${window.location.origin}/api/menu`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load menu");
        return r.json();
      })
      .then((data) => {
        const cats: Category[] = data.categories ?? [];
        setCategories(cats);
        if (cats.length > 0) setActiveId(cats[0].id);
      })
      .catch((err) => {
        console.error("FETCH ERROR:", err);
        setError("Could not load menu. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!navRef.current || !activeId) return;
    const btn = navRef.current.querySelector<HTMLButtonElement>(
      `[data-id="${activeId}"]`
    );
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);
  useEffect(() => {
  const handleScroll = () => {
    setNavScrolled(window.scrollY > 80);
  };

  window.addEventListener("scroll", handleScroll);

  return () => window.removeEventListener("scroll", handleScroll);
}, []);

  const handleProductAdd = (product: Product) => setModalProduct(product);

  const handleModalConfirm = (
    product: Product,
    selections: Record<string, Set<string>>,
    optionsMeta: Record<string, { label: string; price_delta: number }[]>,
    extraPrice: number
  ) => {
    add(product, selections, optionsMeta, extraPrice);
    setModalProduct(null);
  };

  if (loading) {
    return (
      <div className={styles.statePage}>
        <div className={styles.spinner} />
        <span className={styles.stateText}>Loading menu…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.statePage}>
        <span className={styles.errorText}>{error}</span>
        <button className={styles.retryBtn} onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className={styles.statePage}>
        <span className={styles.stateText}>No menu available right now.</span>
      </div>
    );
  }

  const active = categories.find((c) => c.id === activeId);

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.orb1} aria-hidden="true" />
      <div className={styles.orb2} aria-hidden="true" />

      {/* Fixed category nav — sits below <Navbar /> via top: var(--navbar-h) */}
     <div
  className={`${styles.navWrap} ${
    navScrolled ? styles.navWrapScrolled : ""
  }`}
>
  <nav
    className={styles.navCategories}
    ref={navRef}
    aria-label="Menu categories"
  >
    {categories.map((cat) => (
      <button
        key={cat.id}
        data-id={cat.id}
        onClick={() => setActiveId(cat.id)}
        className={`${styles.navBtn} ${
          cat.id === activeId ? styles.navBtnActive : ""
        }`}
      >
        {cat.name}

        <span
          className={`${styles.navCount} ${
            cat.id === activeId ? styles.navCountActive : ""
          }`}
        >
          {cat.products.length}
        </span>
      </button>
    ))}
  </nav>
</div>

      {/*
        Spacer = height of the fixed category nav.
        The <Navbar /> is in normal flow so it already pushes content down.
        This spacer accounts for the category nav which is fixed (out of flow).
      */}
      <div className={styles.navSpacer} aria-hidden="true" />

      {/* Category hero */}
      {active && <CategoryHero key={active.id} category={active} />}

      {/* Product grid */}
      <div className={styles.content}>
        {active && active.products.length > 0 ? (
          <div className={styles.grid}>
            {active.products.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                onAdd={handleProductAdd}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.stateText}>Nothing here yet.</span>
          </div>
        )}
      </div>

      {modalProduct && (
        <ProductOptionsModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      {totalItems > 0 && (
        <div className={styles.cartBar}>
          <button
            className={styles.cartBtnFull}
            onClick={() => setCartOpen(true)}
          >
            <span className={styles.cartLabel}>View order</span>
            <span className={styles.cartRight}>
              <span className={styles.cartCountPill}>
                {totalItems} item{totalItems > 1 ? "s" : ""}
              </span>
              <span className={styles.cartTotal}>€{totalPrice.toFixed(2)}</span>
              <span className={styles.cartArrow}>→</span>
            </span>
          </button>

        </div>

      )}
      {checkoutOpen && (
        <CheckoutModal
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => setCheckoutOpen(false)}
        />
      )}

  
    </div>
  );
}