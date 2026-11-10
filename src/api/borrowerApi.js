import axios from "axios";

const borrowerApi = axios.create({
  baseURL: import.meta.env.VITE_BORROWER_API,
  headers: { "Content-Type": "application/json" },
});

const marketDataApi = axios.create({
  baseURL: import.meta.env.VITE_MARKET_DATA_API || "http://localhost:8080",
  headers: { "Content-Type": "application/json" },
});

export const getData = async (url, params = {}) => {
  const response = await borrowerApi.get(url, { params });
  return response.data?.data ?? response.data;
};

export const getMarketData = async (url, params = {}) => {
  const response = await marketDataApi.get(url, { params });
  return response.data?.data ?? response.data;
};

export const putData = async (url, payload = {}) => {
  const response = await borrowerApi.put(url, payload);
  return response.data?.data ?? response.data;
};

export const postData = async (url, payload) => {
  const response = await borrowerApi.post(url, payload);
  return response.data?.data ?? response.data;
};

export default borrowerApi;
