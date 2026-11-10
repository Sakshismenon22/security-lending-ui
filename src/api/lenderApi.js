import axios from "axios";

const lenderApi = axios.create({
  baseURL: import.meta.env.VITE_LENDER_API || "http://localhost:8084/api/v1",
  headers: { "Content-Type": "application/json" },
});

export const lenderGet = async (path, params = {}) => {
  const response = await lenderApi.get(path, { params });
  return response.data?.data ?? response.data;
};

export const lenderPost = async (path, payload = {}) => {
  const response = await lenderApi.post(path, payload);
  return response.data?.data ?? response.data;
};

export default lenderApi;
