import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

export function CheckoutScreen({
  session,
  onComplete,
}: {
  session: Session | null;
  onComplete: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handlePlaceOrder = async () => {
    if (!session?.user) {
      Alert.alert("Sign in required");
      return;
    }

    setSubmitting(true);

    // 1. Load cart
    const { data: cart } = await supabase
      .from("cart_items")
      .select("product_id, product_name, price, image, quantity")
      .eq("user_id", session.user.id);

    if (!cart || cart.length === 0) {
      Alert.alert("Cart is empty");
      setSubmitting(false);
      return;
    }

    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    // 2. Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: session.user.id,
        total,
        status: "pending",
      })
      .select()
      .single();

    if (orderError || !order) {
      Alert.alert("Error", orderError?.message ?? "Could not create order");
      setSubmitting(false);
      return;
    }

    // 3. Insert order items
    const orderItems = cart.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.product_name,
      price: i.price,
      quantity: i.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      Alert.alert("Error", itemsError.message);
      setSubmitting(false);
      return;
    }

    // 4. Send confirmation email via the web app's API
    try {
      await fetch("https://fans-only-fans.vercel.app/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: session.user.email,
          subject: `Order Confirmation #${order.id.slice(0, 8)}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb;">Fans Only Fans</h1>
              <h2>Thank you for your order!</h2>
              <p>Your order <strong>#${order.id.slice(0, 8)}</strong> has been received.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="text-align: left; padding: 8px;">Item</th>
                    <th style="text-align: right; padding: 8px;">Qty</th>
                    <th style="text-align: right; padding: 8px;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${cart
                    .map(
                      (i) => `
                    <tr>
                      <td style="padding: 8px;">${i.product_name}</td>
                      <td style="text-align: right; padding: 8px;">${i.quantity}</td>
                      <td style="text-align: right; padding: 8px;">₦${(i.price * i.quantity).toLocaleString()}</td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
              <p style="font-size: 18px;"><strong>Total: ₦${total.toLocaleString()}</strong></p>
              <p>— The Fans Only Fans Team</p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.log("Email failed but order placed:", e);
    }

    // 5. Clear cart
    await supabase.from("cart_items").delete().eq("user_id", session.user.id);

    setSubmitting(false);
    Alert.alert(
      "Order placed!",
      `Order #${order.id.slice(0, 8)} — check your email for confirmation.`,
      [{ text: "OK", onPress: onComplete }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Confirm your order</Text>
        <Text style={styles.subtitle}>
          We'll send a confirmation email to {session?.user?.email}.
        </Text>
      </View>

      <TouchableOpacity
        onPress={handlePlaceOrder}
        disabled={submitting}
        style={[styles.button, submitting && { opacity: 0.6 }]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Place Order</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  subtitle: { color: "#6b7280", marginTop: 8 },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});