import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "./lib/supabase";
import { CartScreen } from "./screens/CartScreen";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import type { Session } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
};

type Screen = "shop" | "cart" | "checkout";

const Stack = createNativeStackNavigator();

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("shop");

  useEffect(() => {
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image, description, category")
        .order("name");
      if (!error && data) setProducts(data);
      setLoading(false);
    };
    loadProducts();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_e, s) => setSession(s)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setCartCount(0);
      return;
    }
    const loadCart = async () => {
      const { data } = await supabase
        .from("cart_items")
        .select("quantity")
        .eq("user_id", session.user.id);
      if (data) {
        setCartCount(data.reduce((s, r) => s + r.quantity, 0));
      }
    };
    loadCart();
    const channel = supabase
      .channel(`app-cart-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => loadCart()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleGoogleSignIn = async () => {
    const redirectTo = AuthSession.makeRedirectUri({
      scheme: "fansonlyfansmobile",
      path: "auth-callback",
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      Alert.alert("Sign-in error", error?.message ?? "Could not sign in");
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "success" && result.url) {
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setScreen("shop");
  };

  const handleAddToCart = async (product: Product) => {
    if (!session?.user) {
      Alert.alert("Sign in required", "Please sign in to add items.");
      return;
    }
    setAddingId(product.id);
    const { data: existing } = await supabase
      .from("cart_items")
      .select("quantity")
      .eq("user_id", session.user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + 1 })
        .eq("user_id", session.user.id)
        .eq("product_id", product.id);
    } else {
      await supabase.from("cart_items").insert({
        user_id: session.user.id,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      });
    }
    setAddingId(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🌀 Fans Only Fans</Text>
          <Text style={styles.headerSubtitle}>
            {session?.user?.email ?? "Premium fans for every room"}
          </Text>
        </View>
        {session?.user ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={handleSignOut}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            style={styles.signInButton}
          >
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          onPress={() => setScreen("shop")}
          style={[styles.tab, screen === "shop" && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              screen === "shop" && styles.tabTextActive,
            ]}
          >
            Shop
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setScreen("cart")}
          style={[styles.tab, screen === "cart" && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              screen === "cart" && styles.tabTextActive,
            ]}
          >
            Cart {cartCount > 0 && `(${cartCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      {screen === "shop" && (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image
                source={{
                  uri: `https://fans-only-fans.vercel.app${item.image}`,
                }}
                style={styles.image}
                resizeMode="contain"
              />
              <View style={styles.cardBody}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.price}>
                  ₦{item.price.toLocaleString()}
                </Text>
                <TouchableOpacity
                  onPress={() => handleAddToCart(item)}
                  disabled={addingId === item.id}
                  style={[
                    styles.addButton,
                    addingId === item.id && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.addButtonText}>
                    {addingId === item.id ? "Adding..." : "Add to Cart"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {screen === "cart" && (
        <CartScreen
          session={session}
          onCheckout={() => setScreen("checkout")}
        />
      )}

      {screen === "checkout" && (
        <CheckoutScreen
          session={session}
          onComplete={() => setScreen("shop")}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#2563eb" },
  headerSubtitle: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  signInButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  signInText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  smallButton: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallButtonText: { color: "#374151", fontWeight: "600", fontSize: 13 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#2563eb" },
  tabText: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  tabTextActive: { color: "#2563eb", fontWeight: "700" },
  list: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  image: { width: "100%", height: 200, backgroundColor: "#fff" },
  cardBody: { padding: 16 },
  category: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  name: { fontSize: 16, fontWeight: "600", color: "#111827" },
  price: { fontSize: 18, fontWeight: "bold", color: "#111827", marginTop: 8 },
  addButton: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});