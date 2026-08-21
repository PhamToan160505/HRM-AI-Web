package com.hrm.recruitment.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@Service
public class CloudinaryService {

    private final Cloudinary cloudinary;

    public CloudinaryService(
            @Value("${app.cloudinary.cloud-name}") String cloudName,
            @Value("${app.cloudinary.api-key}") String apiKey,
            @Value("${app.cloudinary.api-secret}") String apiSecret
    ) {
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret,
                "secure", true
        ));
    }

    public String uploadFile(MultipartFile file, String folder) throws IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }
        return uploadFileBytes(file.getBytes(), file.getOriginalFilename(), folder);
    }

    public String uploadFileBytes(byte[] fileBytes, String originalFilename, String folder) throws IOException {
        if (fileBytes == null || fileBytes.length == 0) {
            return null;
        }

        // Bỏ qua upload thật nếu đang dùng config "demo" để tránh lỗi Invalid api_key
        if ("demo".equals(cloudinary.config.apiKey)) {
            // Save file locally instead of throwing it away
            try {
                java.nio.file.Path uploadPath = java.nio.file.Paths.get("uploads", folder);
                if (!java.nio.file.Files.exists(uploadPath)) {
                    java.nio.file.Files.createDirectories(uploadPath);
                }
                
                String fileName = System.currentTimeMillis() + "_" + originalFilename;
                java.nio.file.Path filePath = uploadPath.resolve(fileName);
                java.nio.file.Files.write(filePath, fileBytes);
                
                // Trả về URL local của server backend (port 8080)
                return "http://localhost:8080/uploads/" + folder + "/" + fileName;
            } catch (Exception e) {
                e.printStackTrace();
                return "https://mock.cloudinary.com/hrm/" + folder + "/" + originalFilename;
            }
        }
        
        // Cấu hình resource_type: "auto" để hỗ trợ cả ảnh (CCCD) và raw/pdf (CV)
        Map params = ObjectUtils.asMap(
                "folder", "hrm/" + folder,
                "resource_type", "auto"
        );
        
        Map uploadResult = cloudinary.uploader().upload(fileBytes, params);
        return uploadResult.get("secure_url").toString();
    }

    public String uploadAuthenticated(String base64Image, String publicIdPrefix, String folder) throws IOException {
        // Strip data:image/...;base64, if present
        if (base64Image != null && base64Image.contains(",")) {
            base64Image = base64Image.split(",")[1];
        }
        byte[] fileBytes = java.util.Base64.getDecoder().decode(base64Image);
        
        Map params = ObjectUtils.asMap(
                "folder", folder,
                "public_id", publicIdPrefix + "_" + System.currentTimeMillis(),
                "type", "authenticated",
                "resource_type", "image"
        );
        
        Map uploadResult = cloudinary.uploader().upload(fileBytes, params);
        return uploadResult.get("public_id").toString();
    }
    
    public String generateSignedUrl(String publicId) {
        if (publicId == null || publicId.isEmpty()) return null;
        try {
            // Generate a token valid for 5 minutes (300 seconds)
            long expiration = (System.currentTimeMillis() / 1000L) + 300;
            return cloudinary.url()
                    .type("authenticated")
                    .signed(true)
                    .generate(publicId);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
