import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

type CartRow = {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  image: string;
  quantity: number;
};

export function CartScreen({
  session,
  onCheckout,
}: {
  session: Session | null;
  onCheckout: () => void;
}) {
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("cart_items")
        .select("id, product_id, product_name, price, image, quantity")
        .eq("user_id", session.user.id)
        .order("created_at");

      setItems((data ?? []) as CartRow[]);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`cart-screen-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const updateQuantity = async (row: CartRow, delta: number) => {
    const newQty = row.quantity + delta;
    if (newQty < 1) return;
    await supabase
      .from("cart_items")
      .update({ quantity: newQty })
      .eq("id", row.id);
  };

  const removeItem = async (row: CartRow) => {
    await supabase.from("cart_items").delete().eq("id", row.id);
  };

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Sign in to see your cart</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image
              source={{ uri: `https://fans-only-fans.vercel.app${item.image}` }}
              style={styles.thumb}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.product_name}</Text>
              <Text style={styles.price}>
                ₦{item.price.toLocaleString()}
              </Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item, -1)}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item, 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeItem(item)}>
                  <Text style={styles.remove}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Text style={styles.total}>Total: ₦{total.toLocaleString()}</Text>
        <TouchableOpacity style={styles.checkoutBtn} onPress={onCheckout}>
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#6b7280", fontSize: 16 },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  thumb: { width: 70, height: 70, backgroundColor: "#fff" },
  name: { fontWeight: "600", fontSize: 15, color: "#111827" },
  price: { color: "#6b7280", fontSize: 13, marginTop: 2 },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: { fontSize: 16, color: "#374151" },
  qtyText: { fontSize: 15, fontWeight: "600", minWidth: 20, textAlign: "center" },
  remove: { color: "#dc2626", fontSize: 13, marginLeft: 12 },
  footer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 12,
  },
  total: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  checkoutBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  checkoutBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});