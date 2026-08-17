@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup batch script, version 3.3.2
@REM ----------------------------------------------------------------------------
@IF "%__MVNW_ARG0_NAME__%"=="" (SET "MVN_CMD=mvn.cmd") ELSE (SET "MVN_CMD=%__MVNW_ARG0_NAME__%")
@SET MAVEN_WRAPPER_JAR="%~dp0.mvn\wrapper\maven-wrapper.jar"
@SET MAVEN_WRAPPER_PROPERTIES="%~dp0.mvn\wrapper\maven-wrapper.properties"
@SET DOWNLOAD_URL="https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip"

@SET JAVA_HOME_DIR=%JAVA_HOME%
@IF "%JAVA_HOME_DIR%"=="" (
    @FOR /f "tokens=*" %%i IN ('where java.exe') DO @SET JAVA_EXE=%%i
) ELSE (
    @SET JAVA_EXE=%JAVA_HOME%\bin\java.exe
)

@IF NOT EXIST "%JAVA_EXE%" (
    @ECHO Java not found. Please install Java 17 or later.
    @EXIT /b 1
)

@SET WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

@PUSHD %~dp0

@IF EXIST %MAVEN_WRAPPER_JAR% (
    %JAVA_EXE% -jar %MAVEN_WRAPPER_JAR% %WRAPPER_LAUNCHER% %MAVEN_WRAPPER_PROPERTIES% %*
) ELSE (
    ECHO Maven wrapper jar not found. Downloading...
    %JAVA_EXE% -Dmaven.multiModuleProjectDirectory="%~dp0" ^
        -Dmaven.wrapper.launcher="%WRAPPER_LAUNCHER%" ^
        -Dmaven.wrapper.local.repo= ^
        -classpath "%MAVEN_WRAPPER_JAR%" ^
        org.apache.maven.wrapper.MavenWrapperMain %*
)

@POPD
