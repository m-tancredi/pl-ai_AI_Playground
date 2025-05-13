# analysis_api/ml_utils.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error, accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Algoritmi Scikit-learn
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.svm import SVR, SVC
from sklearn.naive_bayes import GaussianNB


def preprocess_data(df, selected_features, selected_target, task_type):
    """
    Preprocessa il DataFrame per l'addestramento.
    Gestisce missing values, scaling (numeriche), encoding (categoriche).
    Restituisce X, y pronti per il training, e il preprocessor addestrato.
    """
    print(f"Preprocessing data. Features: {selected_features}, Target: {selected_target}, Task: {task_type}")

    X_df = df[selected_features].copy()
    y_series = df[selected_target].copy()

    # Identifica colonne numeriche e categoriche in X
    numeric_features = X_df.select_dtypes(include=np.number).columns.tolist()
    categorical_features = X_df.select_dtypes(include=['object', 'category']).columns.tolist()

    print(f"  Numeric features: {numeric_features}")
    print(f"  Categorical features: {categorical_features}")

    # Pipeline di preprocessing
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='mean')), # Gestisci NaN con la media
        ('scaler', StandardScaler()) # Scala features numeriche
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')), # Gestisci NaN con il più frequente
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False)) # One-hot encode
    ])

    # Crea il ColumnTransformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='passthrough' # Lascia altre colonne (se ce ne fossero) invariate
    )

    # Applica preprocessing a X
    X_processed = preprocessor.fit_transform(X_df)
    print(f"  X data processed. Shape: {X_processed.shape}")

    # Preprocessa y per la classificazione (Label Encoding)
    y_processed = y_series
    label_encoder = None # Per mappare indietro le predizioni
    if task_type == 'classification':
        # Verifica se y è già numerica o necessita encoding
        if y_series.dtype == 'object' or pd.api.types.is_categorical_dtype(y_series):
            label_encoder = LabelEncoder()
            y_processed = label_encoder.fit_transform(y_series)
            print(f"  Target column '{selected_target}' label encoded. Classes: {label_encoder.classes_}")
        elif not pd.api.types.is_numeric_dtype(y_series):
            raise ValueError(f"Target column '{selected_target}' for classification is not numeric or categorical.")
        # Assicurati che le etichette siano intere per la maggior parte dei classificatori
        y_processed = y_processed.astype(int)


    # Gestisci NaN nel target (prima del train/test split)
    if pd.Series(y_processed).isnull().any():
        print(f"  Warning: NaN values found in target column '{selected_target}'. Dropping rows.")
        # Crea un DataFrame temporaneo per allineare e droppare NaN
        temp_df = pd.DataFrame(X_processed)
        temp_df['target'] = y_processed
        temp_df.dropna(subset=['target'], inplace=True)
        if temp_df.empty:
            raise ValueError("All rows dropped due to NaNs in target. Cannot proceed.")
        X_processed = temp_df.drop(columns=['target']).values
        y_processed = temp_df['target'].values
        print(f"  Data shape after dropping NaNs in target: X={X_processed.shape}, y={y_processed.shape}")


    return X_processed, y_processed, preprocessor, label_encoder


def get_sklearn_model(algorithm_key, task_type, params=None):
    """Restituisce un'istanza del modello Scikit-learn basata sulla chiave."""
    params = params or {}
    print(f"Initializing model for key: {algorithm_key}, task: {task_type}, params: {params}")

    # Regression Models
    if algorithm_key == 'linear_regression':
        return LinearRegression(**params)
    elif algorithm_key == 'polynomial_regression':
        degree = params.get('degree', 2)
        # PolynomialFeatures è un trasformatore, va usato in pipeline
        return Pipeline([
            ('poly', PolynomialFeatures(degree=degree, include_bias=False)),
            ('linear', LinearRegression())
        ])
    elif algorithm_key == 'decision_tree_regressor':
        return DecisionTreeRegressor(random_state=42, **params)
    elif algorithm_key == 'random_forest_regressor':
        return RandomForestRegressor(random_state=42, n_jobs=-1, **params) # n_jobs=-1 usa tutti i core
    elif algorithm_key == 'svr':
        return SVR(**params)

    # Classification Models
    elif algorithm_key == 'logistic_regression':
        return LogisticRegression(random_state=42, solver='liblinear', **params) # liblinear per dataset piccoli/binari
    elif algorithm_key == 'svc':
        return SVC(random_state=42, probability=True, **params) # probability=True per predict_proba
    elif algorithm_key == 'decision_tree_classifier':
        return DecisionTreeClassifier(random_state=42, **params)
    elif algorithm_key == 'random_forest_classifier':
        return RandomForestClassifier(random_state=42, n_jobs=-1, **params)
    elif algorithm_key == 'naive_bayes_classifier':
        return GaussianNB(**params)
    else:
        raise ValueError(f"Unsupported algorithm_key: {algorithm_key}")


def calculate_regression_metrics(y_true, y_pred):
    return {
        "r2_score": r2_score(y_true, y_pred),
        "mse": mean_squared_error(y_true, y_pred),
        "mae": mean_absolute_error(y_true, y_pred),
        "rmse": np.sqrt(mean_squared_error(y_true, y_pred))
    }

def calculate_classification_metrics(y_true, y_pred, y_pred_proba=None, labels=None, class_names=None):
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision_macro": precision_score(y_true, y_pred, average='macro', zero_division=0),
        "recall_macro": recall_score(y_true, y_pred, average='macro', zero_division=0),
        "f1_macro": f1_score(y_true, y_pred, average='macro', zero_division=0),
    }
    if class_names and len(class_names) == 2: # Metriche binarie
        metrics["precision_binary"] = precision_score(y_true, y_pred, pos_label=1, zero_division=0) # Assume 1 è la classe positiva
        metrics["recall_binary"] = recall_score(y_true, y_pred, pos_label=1, zero_division=0)
        metrics["f1_binary"] = f1_score(y_true, y_pred, pos_label=1, zero_division=0)

    # Matrice di confusione (come lista di liste)
    cm = confusion_matrix(y_true, y_pred, labels=labels).tolist() # labels sono gli indici unici delle classi
    metrics["confusion_matrix"] = cm
    if class_names and labels: # Aggiungi etichette alla matrice
        metrics["confusion_matrix_labels"] = [class_names[i] for i in labels]

    # TODO: ROC AUC (richiede y_pred_proba)
    # if y_pred_proba is not None and len(np.unique(y_true)) == 2: # Solo per binaria
    #     from sklearn.metrics import roc_auc_score
    #     metrics["roc_auc"] = roc_auc_score(y_true, y_pred_proba[:, 1])

    return metrics

# --- Funzioni per Plot (Esempio con Plotly, da adattare) ---
# Queste funzioni genererebbero JSON per Plotly.js nel frontend

def generate_regression_plot_data(X_test, y_test, y_pred, feature_name, target_name):
    """Prepara dati per uno scatter plot y_true vs y_pred e linea ideale."""
    plot_data = {
        "type": "regression_scatter",
        "data": {
            "actual_vs_predicted": [
                {"actual": float(yt), "predicted": float(yp)} for yt, yp in zip(y_test, y_pred)
            ],
            "ideal_line": [ # Linea y=x
                {"x": float(min(y_test.min(), y_pred.min())), "y": float(min(y_test.min(), y_pred.min()))},
                {"x": float(max(y_test.max(), y_pred.max())), "y": float(max(y_test.max(), y_pred.max()))}
            ]
        },
        "layout": {
            "xaxis_title": f"Actual {target_name}",
            "yaxis_title": f"Predicted {target_name}",
            "title": f"Actual vs. Predicted Values for {target_name}"
        }
    }
    return plot_data

def generate_classification_plot_data(X_test, y_test, model, feature_names, target_name, class_names, preprocessor, label_encoder):
    """
    Prepara dati per uno scatter plot con decision boundary (per 2 feature).
    Questo è complesso e dipende molto dal numero di feature. Semplifichiamo.
    Per ora, restituiamo solo i dati per un istogramma delle predizioni.
    """
    # Se abbiamo solo due feature in X_test, potremmo provare a plottare decision boundary
    # Altrimenti, un semplice istogramma delle classi predette
    unique_labels, counts = np.unique(model.predict(X_test), return_counts=True)
    predicted_class_distribution = []
    if label_encoder: # Se il target era stato encodato
        labels_decoded = label_encoder.inverse_transform(unique_labels)
        predicted_class_distribution = [{"class": str(labels_decoded[i]), "count": int(counts[i])} for i in range(len(unique_labels))]
    else: # Se il target era già numerico (ma con nomi classi forniti)
        predicted_class_distribution = [{"class": class_names[int(label)] if int(label) < len(class_names) else f"Class_{int(label)}", "count": int(counts[i])} for i,label in enumerate(unique_labels)]


    plot_data = {
        "type": "classification_predictions_histogram",
        "data": predicted_class_distribution,
        "layout": {
            "xaxis_title": "Predicted Class",
            "yaxis_title": "Count",
            "title": f"Distribution of Predicted Classes for {target_name}"
        }
    }
    return plot_data