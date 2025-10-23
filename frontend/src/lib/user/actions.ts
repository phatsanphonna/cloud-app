import axios from "axios"

export const getMe = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return null;
  }

  try {
    const user = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (user.status !== 200) {
      return null;
    }

    return user.data;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

export const signOut = () => {
  localStorage.removeItem("token");
  window.location.reload();
}